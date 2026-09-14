const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const REPORT_TYPES = new Set(['message', 'comment', 'user', 'app_error']);

router.post('/', auth, async (req, res) => {
  try {
    const type = String(req.body.type || '').trim();
    const reason = String(req.body.reason || '').trim();
    const details = String(req.body.details || '').trim();
    const targetUserId = req.body.targetUserId || null;
    const targetMessageId = req.body.targetMessageId || null;
    let targetPostId = req.body.targetPostId || null;
    const targetCommentId = req.body.targetCommentId || null;
    if (!REPORT_TYPES.has(type)) return res.status(400).json({ error: 'Invalid report type' });
    if (!reason) return res.status(400).json({ error: 'Report reason is required' });
    if (type === 'app_error' && !details) return res.status(400).json({ error: 'Please describe the app error' });

    let reportedContent = details || null;
    if (type === 'message') {
      if (!targetMessageId) return res.status(400).json({ error: 'Message is required' });
      const message = await prisma.message.findUnique({ where: { id: targetMessageId }, include: { sender: { select: { id: true, username: true, displayName: true } } } });
      if (!message) return res.status(404).json({ error: 'Message not found' });
      const isMember = message.conversationId
        ? await prisma.conversation.findFirst({ where: { id: message.conversationId, OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }] } })
        : await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: message.groupId, userId: req.user.id } } });
      if (!isMember) return res.status(403).json({ error: 'You cannot report this message' });
      reportedContent = message.content || message.fileUrl || message.type;
    }
    if (type === 'comment') {
      if (!targetCommentId) return res.status(400).json({ error: 'Comment is required' });
      const comment = await prisma.comment.findUnique({ where: { id: targetCommentId }, select: { id: true, content: true, postId: true } });
      if (!comment) return res.status(404).json({ error: 'Comment not found' });
      targetPostId = comment.postId;
      reportedContent = comment.content;
    }
    if (type === 'user') {
      if (!targetUserId) return res.status(400).json({ error: 'User is required' });
      const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, username: true, displayName: true } });
      if (!target) return res.status(404).json({ error: 'User not found' });
      if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot report yourself' });
      reportedContent = `${target.displayName || target.username} (@${target.username})`;
    }

    const report = await prisma.report.create({ data: { reporterId: req.user.id, type, reason, details: details || null, targetUserId, targetMessageId, targetPostId, targetCommentId, reportedContent } });
    res.status(201).json({ report });
  } catch (err) {
    console.error('Report submission failed:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

module.exports = router;
