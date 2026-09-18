const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { hashPassword, comparePassword, generateToken, sanitizeUser } = require('../utils/helpers');
const { auth } = require('../middleware/auth');
const { notifyAdmins } = require('../utils/adminNotifications');
const crypto = require('crypto');

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
        approvalStatus: 'PENDING',
        coinBalance: 100 // Welcome bonus test coins
      }
    });

    await notifyAdmins(req.app.get('prisma') || prisma, req.app.get('io'), {
      title: 'New user registration',
      message: `${cleanDisplayName} (@${cleanUsername}) တစ်ယောက် Register တင်ထားပါတယ်။ Admin approval လိုအပ်ပါတယ်။`,
      type: 'user_registration',
      data: { userId: user.id, username: user.username }
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

// Password reset request (does not reveal whether a username exists).
router.post('/forgot-password', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    if (username.length < 3) return res.status(400).json({ error: 'Username is required' });
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true, username: true, displayName: true }
    });
    if (user) {
      const pending = await prisma.passwordResetRequest.findFirst({ where: { userId: user.id, status: 'PENDING' } });
      if (!pending) {
        const request = await prisma.passwordResetRequest.create({ data: { userId: user.id, usernameSnapshot: user.username } });
        await notifyAdmins(req.app.get('prisma') || prisma, req.app.get('io'), {
          title: 'Password reset request',
          message: `${user.displayName || user.username} (@${user.username}) က password အသစ်တောင်းထားပါတယ်။`,
          type: 'password_reset_request',
          data: { requestId: request.id, userId: user.id, username: user.username }
        });
      }
    }
    res.json({ success: true, message: 'Request တင်ပြီးပါပြီ။ Admin မှ စစ်ဆေးပြီး password အသစ်ပေးပါမယ်။' });
  } catch (err) {
    console.error('Password reset request failed:', err);
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

// Login page polls this endpoint and shows the generated password once.
router.get('/reset-password-status', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) return res.json({ status: 'NONE' });
    const request = await prisma.passwordResetRequest.findFirst({
      where: { usernameSnapshot: { equals: username, mode: 'insensitive' }, status: 'RESOLVED', viewedAt: null, resolvedAt: { not: null } },
      orderBy: { resolvedAt: 'desc' },
      select: { id: true, status: true, temporaryPassword: true, resolvedAt: true }
    });
    if (!request || !request.temporaryPassword || (Date.now() - new Date(request.resolvedAt).getTime()) > 24 * 60 * 60 * 1000) return res.json({ status: 'PENDING' });
    await prisma.passwordResetRequest.update({ where: { id: request.id }, data: { viewedAt: new Date() } });
    res.json({ status: 'READY', temporaryPassword: request.temporaryPassword });
  } catch (err) {
    res.status(500).json({ error: 'Could not check reset status' });
  }
});

router.get('/approval-status', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) return res.json({ status: 'NONE' });
    const user = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } }, select: { approvalStatus: true, isApproved: true } });
    if (!user) return res.json({ status: 'NONE' });
    res.json({ status: user.approvalStatus || (user.isApproved ? 'APPROVED' : 'PENDING') });
  } catch (err) { res.status(500).json({ error: 'Could not check approval status' }); }
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
    const approvalStatus = user.approvalStatus || (user.isApproved ? 'APPROVED' : 'PENDING');
    if (approvalStatus === 'REJECTED') {
      return res.status(403).json({ code: 'REGISTRATION_REJECTED', error: 'Admin မှ သင့် Account Register ကို လက်မခံသေးပါ။ Admin ကို ဆက်သွယ်ပါ။' });
    }
    if (!user.isApproved || approvalStatus !== 'APPROVED') {
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
