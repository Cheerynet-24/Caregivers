const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { persistUpload } = require('../utils/uploads');

const prisma = new PrismaClient();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('application/') || file.mimetype.startsWith('text/'))
});
const parsePostUpload = (req, res, next) => upload.array('media', 10)(req, res, error => {
  if (!error) return next();
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Each post file must be 150 MB or smaller' });
  if (error.code === 'LIMIT_FILE_COUNT') return res.status(413).json({ error: 'A post can contain up to 10 files' });
  if (error.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: 'Use the media field for post attachments' });
  return res.status(400).json({ error: error.message || 'Post upload could not be read' });
});

const authorSelect = { id: true, username: true, displayName: true, avatar: true };
const commentInclude = {
  author: { select: authorSelect },
  likes: { select: { userId: true } },
  replies: { include: { author: { select: authorSelect }, likes: { select: { userId: true } } }, orderBy: { createdAt: 'asc' } }
};
const postInclude = {
  author: { select: authorSelect },
  likes: { select: { userId: true } },
  saves: { select: { userId: true } },
  comments: { where: { parentId: null }, include: commentInclude, orderBy: { createdAt: 'asc' } }
};

const shapeComment = (comment, userId) => ({
  ...comment,
  likeCount: comment.likes.length,
  liked: comment.likes.some(like => like.userId === userId),
  replies: (comment.replies || []).map(reply => ({ ...reply, likeCount: reply.likes.length, liked: reply.likes.some(like => like.userId === userId) }))
});
const shapePost = (post, userId) => ({
  ...post,
  mediaItems: post.mediaUrls ? (() => { try { return JSON.parse(post.mediaUrls) } catch { return [] } })() : (post.mediaUrl ? [{ url: post.mediaUrl, type: post.mediaType || '' }] : []),
  likeCount: post.likes.length,
  liked: post.likes.some(like => like.userId === userId),
  saved: post.saves.some(save => save.userId === userId),
  comments: post.comments.map(comment => shapeComment(comment, userId))
});
const notifyPostOwner = async ({ postId, commentId = null, actorId, action, io }) => {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post || post.authorId === actorId) return;
  const friendship = await prisma.friendship.findFirst({ where: { OR: [{ user1Id: actorId, user2Id: post.authorId }, { user1Id: post.authorId, user2Id: actorId }] } });
  if (!friendship) return;
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { displayName: true, username: true } });
  const actorName = actor?.displayName || actor?.username || 'Someone';
  const notification = await prisma.notification.create({ data: { userId: post.authorId, title: 'Post activity', message: `${actorName} ${action} your post.`, postId, commentId } });
  io?.to(`user:${post.authorId}`).emit('notification:new', notification);
};

router.get('/', auth, async (req, res) => {
  try {
    const friendships = await prisma.friendship.findMany({ where: { OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }] }, select: { user1Id: true, user2Id: true } });
    const friendIds = friendships.map(friendship => friendship.user1Id === req.user.id ? friendship.user2Id : friendship.user1Id);
    const posts = await prisma.post.findMany({ where: { OR: [{ authorId: req.user.id }, { visibility: 'public', author: { allowPostsFrom: 'everyone' } }, { visibility: 'friends', authorId: { in: friendIds } }] }, include: postInclude, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ posts: posts.map(post => shapePost(post, req.user.id)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load feed' }); }
});

router.get('/saved', auth, async (req, res) => {
  try {
    const saved = await prisma.postSave.findMany({ where: { userId: req.user.id }, include: { post: { include: postInclude } }, orderBy: { createdAt: 'desc' } });
    res.json({ posts: saved.map(item => shapePost(item.post, req.user.id)) });
  } catch (err) { res.status(500).json({ error: 'Failed to load saved posts' }); }
});

router.post('/', auth, parsePostUpload, async (req, res) => {
  try {
    const caption = String(req.body.caption || '').trim();
    const visibility = req.body.visibility === 'friends' ? 'friends' : 'public';
    const files = req.files || [];
    if (!caption && !files.length) return res.status(400).json({ error: 'Caption or media is required' });
    const mediaItems = await Promise.all(files.map(async file => ({ url: await persistUpload(file, 'posts'), type: file.mimetype || '', name: file.originalname || '' })));
    const first = mediaItems[0] || null;
    const post = await prisma.post.create({ data: { authorId: req.user.id, caption: caption || null, visibility, mediaUrl: first?.url || null, mediaType: first?.type || null, mediaUrls: mediaItems.length ? JSON.stringify(mediaItems) : null }, include: postInclude });
    res.status(201).json({ post: shapePost(post, req.user.id) });
  } catch (err) { console.error('post create error:', err); res.status(500).json({ error: err.message || 'Failed to create post' }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.authorId !== req.user.id) return res.status(403).json({ error: 'You can edit your own posts only' });
    const post = await prisma.post.update({ where: { id: existing.id }, data: { caption: String(req.body.caption || '').trim() || null }, include: postInclude });
    res.json({ post: shapePost(post, req.user.id) });
  } catch (err) { res.status(500).json({ error: 'Failed to edit post' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.authorId !== req.user.id) return res.status(403).json({ error: 'You can delete your own posts only' });
    await prisma.post.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete post' }); }
});

router.post('/:id/like', auth, async (req, res) => {
  try {
    const where = { postId_userId: { postId: req.params.id, userId: req.user.id } };
    const existing = await prisma.postLike.findUnique({ where });
    if (existing) await prisma.postLike.delete({ where }); else { await prisma.postLike.create({ data: { postId: req.params.id, userId: req.user.id } }); notifyPostOwner({ postId: req.params.id, actorId: req.user.id, action: 'liked', io: req.app.get('io') }).catch(error => console.error('post like notification error', error)); }
    res.json({ liked: !existing });
  } catch (err) { res.status(500).json({ error: 'Failed to like post' }); }
});

router.post('/:id/save', auth, async (req, res) => {
  try {
    const where = { postId_userId: { postId: req.params.id, userId: req.user.id } };
    const existing = await prisma.postSave.findUnique({ where });
    if (existing) await prisma.postSave.delete({ where }); else { await prisma.postSave.create({ data: { postId: req.params.id, userId: req.user.id } }); notifyPostOwner({ postId: req.params.id, actorId: req.user.id, action: 'saved', io: req.app.get('io') }).catch(error => console.error('post save notification error', error)); }
    res.json({ saved: !existing });
  } catch (err) { res.status(500).json({ error: 'Failed to save post' }); }
});

router.post('/:id/comments', auth, async (req, res) => {
  try {
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Comment is required' });
    const comment = await prisma.comment.create({ data: { postId: req.params.id, authorId: req.user.id, parentId: req.body.parentId || null, content }, include: commentInclude });
    notifyPostOwner({ postId: req.params.id, commentId: comment.id, actorId: req.user.id, action: 'commented on', io: req.app.get('io') }).catch(error => console.error('post comment notification error', error));
    res.status(201).json({ comment: shapeComment(comment, req.user.id) });
  } catch (err) { res.status(500).json({ error: 'Failed to add comment' }); }
});

router.put('/comments/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.authorId !== req.user.id) return res.status(403).json({ error: 'You can edit your own comments only' });
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Comment is required' });
    const comment = await prisma.comment.update({ where: { id: existing.id }, data: { content }, include: commentInclude });
    res.json({ comment: shapeComment(comment, req.user.id) });
  } catch (err) { res.status(500).json({ error: 'Failed to edit comment' }); }
});

router.delete('/comments/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.authorId !== req.user.id) return res.status(403).json({ error: 'You can delete your own comments only' });
    await prisma.comment.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete comment' }); }
});

router.post('/comments/:id/like', auth, async (req, res) => {
  try {
    const where = { commentId_userId: { commentId: req.params.id, userId: req.user.id } };
    const existing = await prisma.commentLike.findUnique({ where });
    if (existing) await prisma.commentLike.delete({ where }); else await prisma.commentLike.create({ data: { commentId: req.params.id, userId: req.user.id } });
    res.json({ liked: !existing });
  } catch (err) { res.status(500).json({ error: 'Failed to like comment' }); }
});

module.exports = router;
