const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { hashPassword, comparePassword, generateToken, sanitizeUser } = require('../utils/helpers');
const { auth } = require('../middleware/auth');

const prisma = new PrismaClient();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;
    const cleanUsername = String(username || '').trim();
    const cleanDisplayName = String(displayName || username || '').trim();
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const existingUsername = await prisma.user.findFirst({ where: { username: { equals: cleanUsername, mode: 'insensitive' } }, select: { id: true } });
    if (existingUsername) return res.status(409).json({ field: 'username', error: 'ဒီ Username ကို အသုံးပြုပြီးသားဖြစ်လို့ မရပါ။ အခြား Username ရွေးပါ။' });
    const existingDisplayName = await prisma.user.findFirst({ where: { displayName: { equals: cleanDisplayName, mode: 'insensitive' } }, select: { id: true } });
    if (existingDisplayName) return res.status(409).json({ field: 'displayName', error: 'ဒီ Display name ကို အသုံးပြုပြီးသားဖြစ်လို့ မရပါ။ အခြား Display name ရွေးပါ။' });

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        password: hashed,
        displayName: cleanDisplayName,
        email: email || null,
        isApproved: false,
        coinBalance: 100 // Welcome bonus test coins
      }
    });

    res.status(201).json({
      message: 'Registration submitted. Please wait for admin approval.',
      pendingApproval: true,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Account is banned' });
    }
    if (!user.isApproved) {
      return res.status(403).json({ error: 'Account is waiting for admin approval' });
    }

    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update online
    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() }
    });

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Me
router.get('/me', auth, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || String(newPassword).length < 4) return res.status(400).json({ error: 'Current password and a new password of at least 4 characters are required' });
    if (!await comparePassword(currentPassword, req.user.password)) return res.status(401).json({ error: 'Current password is incorrect' });
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { password: await hashPassword(newPassword), mustResetPassword: false } });
    res.json({ user: sanitizeUser(user) });
  } catch (err) { res.status(500).json({ error: 'Password update failed' }); }
});

router.put('/fcm-token', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || String(token).length > 4096) return res.status(400).json({ error: 'Valid FCM token required' });
    await prisma.user.update({ where: { id: req.user.id }, data: { fcmToken: String(token) } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'FCM token registration failed' }); }
});

// Logout (set offline)
router.post('/logout', auth, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { isOnline: false, lastSeen: new Date() }
  });
  res.json({ message: 'Logged out' });
});

router.delete('/me', auth, async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { senderId: req.user.id } });
      await tx.groupMember.deleteMany({ where: { userId: req.user.id } });
      await tx.friendship.deleteMany({ where: { OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }] } });
      await tx.friendRequest.deleteMany({ where: { OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }] } });
      await tx.depositRequest.deleteMany({ where: { userId: req.user.id } });
      await tx.withdrawRequest.deleteMany({ where: { userId: req.user.id } });
      await tx.conversation.deleteMany({ where: { OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }] } });
      await tx.group.updateMany({ where: { createdById: req.user.id }, data: { createdById: null } });
      await tx.user.delete({ where: { id: req.user.id } });
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Account deletion failed:', err);
    res.status(500).json({ error: 'Account deletion failed' });
  }
});
module.exports = router;
