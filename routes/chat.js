const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const prisma = new PrismaClient();
const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const mediaUpload = multer({
  storage: mediaStorage,
  fileFilter: (req, file, cb) => {
    const allowed = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/') || file.mimetype === 'application/pdf';
    cb(allowed ? null : new Error('Unsupported file type'), allowed);
  }
});

router.post('/upload', auth, mediaUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  const type = req.file.mimetype.startsWith('image/') ? 'image' : req.file.mimetype.startsWith('video/') ? 'video' : req.file.mimetype.startsWith('audio/') ? 'audio' : 'file';
  res.status(201).json({ fileUrl: `/uploads/${req.file.filename}`, type, name: req.file.originalname });
});

// Get or create 1-1 conversation
router.post('/conversation', auth, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId required' });
    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { allowMessagesFrom: true } });
    if (!otherUser) return res.status(404).json({ error: 'User not found' });
    if (otherUser.allowMessagesFrom === 'friends') {
      const friendship = await prisma.friendship.findFirst({ where: { OR: [{ user1Id: req.user.id, user2Id: otherUserId }, { user1Id: otherUserId, user2Id: req.user.id }] } });
      if (!friendship) return res.status(403).json({ error: 'This user accepts messages from friends only' });
    }
    const blocked = await prisma.blockedUser.findFirst({ where: { OR: [{ blockerId: req.user.id, blockedId: otherUserId }, { blockerId: otherUserId, blockedId: req.user.id }] } });
    if (blocked) return res.status(403).json({ error: 'This user is blocked' });

    let conv = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        OR: [
          { user1Id: req.user.id, user2Id: otherUserId },
          { user1Id: otherUserId, user2Id: req.user.id }
        ]
      }
    });

    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          isGroup: false,
          user1Id: req.user.id,
          user2Id: otherUserId
        }
      });
    }

    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/conversation/:id', auth, async (req, res) => {
  const conversation = await prisma.conversation.findFirst({ where: { id: req.params.id, OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }] } });
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  await prisma.conversation.delete({ where: { id: conversation.id } });
  res.json({ success: true });
});

router.post('/block/:userId', auth, async (req, res) => {
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Invalid user' });
  const block = await prisma.blockedUser.upsert({
    where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: req.params.userId } },
    update: {},
    create: { blockerId: req.user.id, blockedId: req.params.userId }
  });
  res.json({ success: true, block });
});

router.delete('/block/:userId', auth, async (req, res) => {
  await prisma.blockedUser.deleteMany({ where: { blockerId: req.user.id, blockedId: req.params.userId } });
  res.json({ success: true });
});

// Get messages for conversation
router.get('/messages/:conversationId', auth, async (req, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.conversationId,
        OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }]
      }
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.conversationId },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatar: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: 200
    });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get group messages
router.get('/group-messages/:groupId', auth, async (req, res) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: req.params.groupId, userId: req.user.id }
      }
    });
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const messages = await prisma.message.findMany({
      where: { groupId: req.params.groupId },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatar: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: 300
    });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get recent conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const convs = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1Id: req.user.id },
          { user2Id: req.user.id }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        user1: { select: { id: true, username: true, displayName: true, avatar: true, isOnline: true } },
        user2: { select: { id: true, username: true, displayName: true, avatar: true, isOnline: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    const enriched = convs.map((c) => {
      const other = c.user1Id === req.user.id ? c.user2 : c.user1;
      return { ...c, otherUser: other, lastMessage: c.messages?.[0] || null, messages: undefined };
    });

    res.json({ conversations: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/call-history', auth, async (req, res) => {
  try {
    const calls = await prisma.callLog.findMany({ where: { OR: [{ callerId: req.user.id }, { receiverId: req.user.id }] }, include: { caller: { select: { id: true, username: true, displayName: true, avatar: true } }, receiver: { select: { id: true, username: true, displayName: true, avatar: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ calls });
  } catch (err) { res.status(500).json({ error: 'Failed to load call history' }); }
});

module.exports = router;
