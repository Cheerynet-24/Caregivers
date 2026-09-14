const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { sanitizeUser, compactUser } = require('../utils/helpers');

const prisma = new PrismaClient();

router.get('/notifications', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// Search all users (for "Search Friend")
router.get('/search', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        isBanned: false,
        ...(q ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } }
          ]
        } : {})
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
        bio: true
      },
      take: 100,
      orderBy: { username: 'asc' }
    });
    res.json({ users: users.map(compactUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get friends
router.get('/friends', auth, async (req, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: req.user.id },
          { user2Id: req.user.id }
        ]
      },
      include: {
        user1: { select: { id: true, username: true, displayName: true, isOnline: true, lastSeen: true } },
        user2: { select: { id: true, username: true, displayName: true, isOnline: true, lastSeen: true } }
      }
    });

    const friends = friendships.map(f => {
      return f.user1Id === req.user.id ? f.user2 : f.user1;
    });
    res.json({ friends: friends.map(compactUser) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

// Send friend request
router.post('/friend-request', auth, async (req, res) => {
  try {
    const { toUserId } = req.body;
    if (!toUserId || toUserId === req.user.id) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: req.user.id, toUserId },
          { fromUserId: toUserId, toUserId: req.user.id }
        ]
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Request already exists' });
    }

    // Check if already friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: req.user.id, user2Id: toUserId },
          { user1Id: toUserId, user2Id: req.user.id }
        ]
      }
    });
    if (friendship) {
      return res.status(400).json({ error: 'Already friends' });
    }

    const request = await prisma.friendRequest.create({
      data: { fromUserId: req.user.id, toUserId }
    });
    res.json({ message: 'Friend request sent', request });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// Accept friend request
router.post('/friend-request/:id/accept', auth, async (req, res) => {
  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.toUserId !== req.user.id) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await prisma.$transaction([
      prisma.friendship.create({
        data: { user1Id: request.fromUserId, user2Id: request.toUserId }
      }),
      prisma.friendRequest.update({
        where: { id: request.id },
        data: { status: 'accepted' }
      })
    ]);

    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept' });
  }
});

// Reject
router.post('/friend-request/:id/reject', auth, async (req, res) => {
  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.toUserId !== req.user.id) {
      return res.status(404).json({ error: 'Request not found' });
    }
    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'rejected' }
    });
    res.json({ message: 'Rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Pending requests
router.get('/friend-requests', auth, async (req, res) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: { toUserId: req.user.id, status: 'pending' },
      include: {
        fromUser: { select: { id: true, username: true, displayName: true } }
      }
    });
    res.json({ requests: requests.map(request => ({ ...request, fromUser: compactUser(request.fromUser) })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const profile = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, username: true, displayName: true, avatar: true, bio: true, isOnline: true, lastSeen: true } });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json({ user: profile });
  } catch { res.status(500).json({ error: 'Failed to load profile' }); }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, displayName, bio, avatar, allowMessagesFrom, allowPostsFrom } = req.body;
    if (username !== undefined) {
      const nextUsername = String(username).trim();
      if (nextUsername.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
      const taken = await prisma.user.findFirst({ where: { username: { equals: nextUsername, mode: 'insensitive' }, id: { not: req.user.id } } });
      if (taken) return res.status(409).json({ field: 'username', error: 'ဒီ Username ကို အသုံးပြုပြီးသားဖြစ်လို့ မရပါ။' });
    }
    if (displayName !== undefined) {
      const nextDisplayName = String(displayName).trim();
      const taken = await prisma.user.findFirst({ where: { displayName: { equals: nextDisplayName, mode: 'insensitive' }, id: { not: req.user.id } } });
      if (taken) return res.status(409).json({ field: 'displayName', error: 'ဒီ Display name ကို အသုံးပြုပြီးသားဖြစ်လို့ မရပါ။' });
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(username !== undefined && { username: String(username).trim() }),
        ...(displayName !== undefined && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(avatar !== undefined && { avatar }),
        ...(allowMessagesFrom !== undefined && { allowMessagesFrom: ['everyone', 'friends'].includes(allowMessagesFrom) ? allowMessagesFrom : 'everyone' }),
        ...(allowPostsFrom !== undefined && { allowPostsFrom: ['everyone', 'friends'].includes(allowPostsFrom) ? allowPostsFrom : 'everyone' }),
      }
    });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

module.exports = router;
