const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const prisma = new PrismaClient();
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../uploads'),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))
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
  likeCount: post.likes.length,
  liked: post.likes.some(like => like.userId === userId),
  saved: post.saves.some(save => save.userId === userId),
  comments: post.comments.map(comment => shapeComment(comment, userId))
});

router.get('/', auth, async (req, res) => {
  try {
    const friendships = await prisma.friendship.findMany({ where: { OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }] }, select: { user1Id: true, user2Id: true } });
    const friendIds = friendships.map(friendship => friendship.user1Id === req.user.id ? friendship.user2Id : friendship.user1Id);
    const posts = await prisma.post.findMany({ where: { OR: [{ authorId: req.user.id }, { author: { allowPostsFrom: 'everyone' } }, { authorId: { in: friendIds } }] }, include: postInclude, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ posts: posts.map(post => shapePost(post, req.user.id)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load feed' }); }
});

router.get('/saved', auth, async (req, res) => {
  try {
    const saved = await prisma.postSave.findMany({ where: { userId: req.user.id }, include: { post: { include: postInclude } }, orderBy: { createdAt: 'desc' } });
    res.json({ posts: saved.map(item => shapePost(item.post, req.user.id)) });
  } catch (err) { res.status(500).json({ error: 'Failed to load saved posts' }); }
});

router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    const caption = String(req.body.caption || '').trim();
    if (!caption && !req.file) return res.status(400).json({ error: 'Caption or media is required' });
    const post = await prisma.post.create({ data: { authorId: req.user.id, caption: caption || null, mediaUrl: req.file ? `/uploads/${req.file.filename}` : null, mediaType: req.file?.mimetype || null }, include: postInclude });
    res.status(201).json({ post: shapePost(post, req.user.id) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create post' }); }
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
    if (existing) await prisma.postLike.delete({ where }); else await prisma.postLike.create({ data: { postId: req.params.id, userId: req.user.id } });
    res.json({ liked: !existing });
  } catch (err) { res.status(500).json({ error: 'Failed to like post' }); }
});

router.post('/:id/save', auth, async (req, res) => {
  try {
    const where = { postId_userId: { postId: req.params.id, userId: req.user.id } };
    const existing = await prisma.postSave.findUnique({ where });
    if (existing) await prisma.postSave.delete({ where }); else await prisma.postSave.create({ data: { postId: req.params.id, userId: req.user.id } });
    res.json({ saved: !existing });
  } catch (err) { res.status(500).json({ error: 'Failed to save post' }); }
});

router.post('/:id/comments', auth, async (req, res) => {
  try {
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Comment is required' });
    const comment = await prisma.comment.create({ data: { postId: req.params.id, authorId: req.user.id, parentId: req.body.parentId || null, content }, include: commentInclude });
    res.status(201).json({ comment: shapeComment(comment, req.user.id) });
  } catch (err) { res.status(500).json({ error: 'Failed to add comment' }); }
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
