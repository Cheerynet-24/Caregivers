const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const { sanitizeUser, compactUser } = require('../utils/helpers');

const prisma = new PrismaClient();

router.get('/notifications', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({ where: { OR: [{ userId: null }, { userId: req.user.id }] }, orderBy: { createdAt: 'desc' }, take: 20 });
    const unreadCount = await prisma.notification.count({ where: { OR: [{ userId: null }, { userId: req.user.id }], reads: { none: { userId: req.user.id } } } });
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.delete('/notifications/:id', auth, async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true } });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.userId !== req.user.id) return res.status(403).json({ error: 'You can delete your own notifications only' });
    await prisma.notification.delete({ where: { id: notification.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete notification' }); }
});
router.post('/notifications/read', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({ where: { OR: [{ userId: null }, { userId: req.user.id }] }, select: { id: true } });
    if (notifications.length) await prisma.notificationRead.createMany({ data: notifications.map(notification => ({ notificationId: notification.id, userId: req.user.id })), skipDuplicates: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to mark notifications read' }); }
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
    const ids = users.map(user => user.id);
    const [friendships, requests] = await Promise.all([
      prisma.friendship.findMany({ where: { OR: [{ user1Id: req.user.id, user2Id: { in: ids } }, { user2Id: req.user.id, user1Id: { in: ids } }] }, select: { user1Id: true, user2Id: true } }),
      prisma.friendRequest.findMany({ where: { status: 'pending', OR: [{ fromUserId: req.user.id, toUserId: { in: ids } }, { toUserId: req.user.id, fromUserId: { in: ids } }] }, select: { fromUserId: true, toUserId: true } })
    ]);
    const friendIds = new Set(friendships.map(item => item.user1Id === req.user.id ? item.user2Id : item.user1Id));
    const sentIds = new Set(requests.filter(item => item.fromUserId === req.user.id).map(item => item.toUserId));
    const receivedIds = new Set(requests.filter(item => item.toUserId === req.user.id).map(item => item.fromUserId));
    res.json({ users: users.map(user => ({ ...compactUser(user), relationshipStatus: friendIds.has(user.id) ? 'FRIEND' : sentIds.has(user.id) ? 'REQUEST_SENT' : receivedIds.has(user.id) ? 'REQUEST_RECEIVED' : 'NONE' })) });
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

router.get('/:id/friends', auth, async (req, res) => {
  try {
    const profile = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, showFriends: true } });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if (!profile.showFriends && profile.id !== req.user.id) return res.json({ friends: [], hidden: true });
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ user1Id: req.params.id }, { user2Id: req.params.id }] },
      select: { user1Id: true, user2Id: true }
    });
    const friendIds = friendships.map(item => item.user1Id === req.params.id ? item.user2Id : item.user1Id);
    const friends = friendIds.length ? await prisma.user.findMany({ where: { id: { in: friendIds } }, select: { id: true, username: true, displayName: true, avatar: true, isOnline: true } }) : [];
    res.json({ friends });
  } catch { res.status(500).json({ error: 'Failed to load friends' }); }
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
    const profile = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, username: true, displayName: true, avatar: true, bio: true, isOnline: true, lastSeen: true, showFriends: true } });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json({ user: profile });
  } catch { res.status(500).json({ error: 'Failed to load profile' }); }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, displayName, bio, avatar, allowMessagesFrom, allowPostsFrom, showFriends } = req.body;
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
        ...(showFriends !== undefined && { showFriends: Boolean(showFriends) }),
      }
    });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

module.exports = router;
