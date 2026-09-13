const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const prisma = new PrismaClient();

// Get or create 1-1 conversation
router.post('/conversation', auth, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId required' });

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
      take: 50
    });

    const enriched = await Promise.all(convs.map(async (c) => {
      const otherId = c.user1Id === req.user.id ? c.user2Id : c.user1Id;
      const other = await prisma.user.findUnique({
        where: { id: otherId },
        select: { id: true, username: true, displayName: true, avatar: true, isOnline: true }
      });
      const lastMsg = await prisma.message.findFirst({
        where: { conversationId: c.id },
        orderBy: { createdAt: 'desc' }
      });
      return { ...c, otherUser: other, lastMessage: lastMsg };
    }));

    res.json({ conversations: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
