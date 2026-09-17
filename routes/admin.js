const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sanitizeUser, hashPassword } = require('../utils/helpers');
const crypto = require('crypto');
const { notifyAdmins } = require('../utils/adminNotifications');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });
const qrDataUrl = (file) => file ? `data:${file.mimetype};base64,${fs.readFileSync(file.path).toString('base64')}` : undefined;

// Device Token Authentication Middleware
const deviceAuth = (req, res, next) => {
  const token = req.headers['x-admin-device'] || req.headers['x-admin-password'] || (req.body && req.body.deviceToken) || req.query.token || (req.body && req.body.password);
  const targetToken = process.env.ADMIN_DEVICE_TOKEN || process.env.ADMIN_PASSWORD || '29580284';

  if (token && targetToken && String(token).trim() === String(targetToken).trim()) {
    return next();
  }
  return res.status(403).json({ error: "Unauthorized device" });
};

// Login route supporting device token / secret key
router.post('/login', (req, res) => {
  const token = req.body.password || req.body.deviceToken || req.headers['x-admin-device'];
  const targetToken = process.env.ADMIN_DEVICE_TOKEN || process.env.ADMIN_PASSWORD || '29580284';
  
  if (token && targetToken && String(token).trim() === String(targetToken).trim()) {
    return res.json({ success: true, message: "Device authenticated" });
  }
  return res.status(401).json({ error: "Wrong password" });
});

router.post('/device-token', deviceAuth, async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    if (!token || token.length > 4096) return res.status(400).json({ error: 'Valid FCM token required' });
    await prisma.adminDevice.upsert({ where: { token }, update: { platform: req.body.platform || null }, create: { token, platform: req.body.platform || null } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Admin device registration failed' }); }
});

router.get('/notifications', deviceAuth, async (req, res) => {
  try {
    const notifications = await prisma.adminNotification.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    const unreadCount = await prisma.adminNotification.count({ where: { readAt: null } });
    res.json({ notifications, unreadCount });
  } catch (err) { res.status(500).json({ error: 'Failed to load admin notifications' }); }
});

router.post('/notifications/read', deviceAuth, async (req, res) => {
  try { await prisma.adminNotification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Failed to mark notifications read' }); }
});

router.get('/password-reset-requests', deviceAuth, async (req, res) => {
  try {
    const requests = await prisma.passwordResetRequest.findMany({ where: { status: 'PENDING' }, include: { user: { select: { id: true, username: true, displayName: true } } }, orderBy: { createdAt: 'asc' } });
    res.json({ requests });
  } catch (err) { res.status(500).json({ error: 'Failed to load password reset requests' }); }
});

// Login
router.get('/payment-info', async (req, res) => {
  try {
    const info = await prisma.paymentInfo.findFirst();
    res.json({ paymentInfo: info || { method: '', accountName: '', phoneNumber: '', instructions: '', qrCode: '' } });
  } catch (err) {
    console.error('Failed to load payment info:', err);
    res.status(500).json({ error: 'Failed to load payment info' });
  }
});

// Save Payment Info (Admin Only)
// Accept both the current frontend field names (bank_name/account_name/phone_number)
// and the database field names (method/accountName/phoneNumber).
router.post('/payment-info', upload.single('qr_image'), deviceAuth, async (req, res) => {
  try {
    const method = String(req.body.method || req.body.bank_name || '').trim();
    const accountName = String(req.body.accountName || req.body.account_name || '').trim();
    const phoneNumber = String(req.body.phoneNumber || req.body.phone_number || '').trim();
    const instructions = String(req.body.instructions || '').trim();
    const qrCode = qrDataUrl(req.file);

    if (!method || !accountName || !phoneNumber) {
      return res.status(400).json({ error: 'Bank/Wallet, Account Name and Phone Number are required' });
    }

    const existing = await prisma.paymentInfo.findFirst();
    let result;
    if (existing) {
      result = await prisma.paymentInfo.update({
        where: { id: existing.id },
        data: { method, accountName, phoneNumber, instructions, ...(qrCode ? { qrCode } : {}) }
      });
    } else {
      result = await prisma.paymentInfo.create({
        data: { method, accountName, phoneNumber, instructions, qrCode: qrCode || null }
      });
    }
    res.json({ success: true, message: "Payment info saved", paymentInfo: result, result });
  } catch (err) {
    console.error('Failed to save payment info:', err);
    res.status(500).json({ error: "Failed to save payment info: " + err.message });
  }
});

// Multiple receiving accounts
router.get('/payment-accounts', deviceAuth, async (req, res) => {
  try {
    const accounts = await prisma.paymentAccount.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ accounts });
  } catch (err) {
    console.error('Failed to load payment accounts:', err);
    res.status(500).json({ error: 'Failed to load payment accounts' });
  }
});

router.post('/payment-accounts', upload.single('qr_image'), deviceAuth, async (req, res) => {
  try {
    const method = String(req.body.method || req.body.bank_name || '').trim();
    const accountName = String(req.body.accountName || req.body.account_name || '').trim();
    const phoneNumber = String(req.body.phoneNumber || req.body.phone_number || '').trim();
    if (!method || !accountName || !phoneNumber) {
      return res.status(400).json({ error: 'Bank/Wallet, Account Name and Phone Number are required' });
    }
    const account = await prisma.paymentAccount.create({
      data: {
        method,
        accountName,
        phoneNumber,
        instructions: String(req.body.instructions || '').trim() || null,
        qrCode: qrDataUrl(req.file) || null
      }
    });
    res.status(201).json({ success: true, message: 'Payment account added', account });
  } catch (err) {
    console.error('Failed to add payment account:', err);
    res.status(500).json({ error: 'Failed to add payment account' });
  }
});

router.delete('/payment-accounts/:id', deviceAuth, async (req, res) => {
  try {
    await prisma.paymentAccount.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Payment account deleted' });
  } catch (err) {
    res.status(404).json({ error: 'Payment account not found' });
  }
});

router.post('/broadcast', deviceAuth, async (req, res) => {
  try {
    const title = String(req.body.title || 'အသိပေးချက်').trim();
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const notification = await prisma.notification.create({ data: { title, message } });
    req.app.get('io')?.emit('notification:new', notification);
    res.status(201).json({ success: true, notification });
  } catch (err) {
    console.error('Failed to broadcast notification:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

router.get('/reports', deviceAuth, async (req, res) => {
  try {
    const reports = await prisma.report.findMany({ include: { reporter: { select: { id: true, username: true, displayName: true } } }, orderBy: { createdAt: 'desc' } });
    const enriched = await Promise.all(reports.map(async report => {
      const [targetUser, targetMessage, targetPost, targetComment] = await Promise.all([
        report.targetUserId ? prisma.user.findUnique({ where: { id: report.targetUserId }, select: { id: true, username: true, displayName: true, isBanned: true } }) : null,
        report.targetMessageId ? prisma.message.findUnique({ where: { id: report.targetMessageId }, include: { sender: { select: { id: true, username: true, displayName: true } } } }) : null,
        report.targetPostId ? prisma.post.findUnique({ where: { id: report.targetPostId }, include: { author: { select: { id: true, username: true, displayName: true } } } }) : null,
        report.targetCommentId ? prisma.comment.findUnique({ where: { id: report.targetCommentId }, include: { author: { select: { id: true, username: true, displayName: true } } } }) : null
      ]);
      return { ...report, targetUser, targetMessage, targetPost, targetComment };
    }));
    res.json({ reports: enriched });
  } catch (err) {
    console.error('Failed to load reports:', err);
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

router.patch('/reports/:id', deviceAuth, async (req, res) => {
  try {
    const status = String(req.body.status || '').trim().toUpperCase();
    if (!['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'].includes(status)) return res.status(400).json({ error: 'Invalid report status' });
    const adminNote = String(req.body.adminNote || '').trim();
    const existing = await prisma.report.findUnique({ where: { id: req.params.id }, select: { id: true, reporterId: true, reason: true, adminNote: true } });
    if (!existing) return res.status(404).json({ error: 'Report not found' });
    const report = await prisma.report.update({ where: { id: req.params.id }, data: { status, adminNote: adminNote || null, reviewedAt: status === 'PENDING' ? null : new Date() } });
    if (adminNote) {
      const notification = await prisma.notification.create({ data: { userId: existing.reporterId, title: 'Report အကြောင်းပြန်စာ', message: `သင်တိုင်ကြားထားသော Report (${existing.reason}) ကို Admin မှ အကြောင်းပြန်ထားပါတယ်။\n\n${adminNote}` } });
      req.app.get('io')?.to(`user:${existing.reporterId}`).emit('notification:new', notification);
    }
    res.json({ report });
  } catch (err) {
    res.status(404).json({ error: 'Report not found' });
  }
});

// All users list
router.get('/users', deviceAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, displayName: true, email: true,
        isOnline: true, isBanned: true, isMuted: true, isApproved: true,
        coinBalance: true, role: true, createdAt: true, lastSeen: true
      }
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post('/users/:id/approve', deviceAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { isApproved: true } });
    res.json({ message: 'User approved', user: sanitizeUser(user) });
  } catch (err) { res.status(404).json({ error: 'User not found' }); }
});

router.delete('/users/:id', deviceAuth, async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { senderId: req.params.id } });
      await tx.groupMember.deleteMany({ where: { userId: req.params.id } });
      await tx.friendship.deleteMany({ where: { OR: [{ user1Id: req.params.id }, { user2Id: req.params.id }] } });
      await tx.friendRequest.deleteMany({ where: { OR: [{ fromUserId: req.params.id }, { toUserId: req.params.id }] } });
      await tx.depositRequest.deleteMany({ where: { userId: req.params.id } });
      await tx.withdrawRequest.deleteMany({ where: { userId: req.params.id } });
      await tx.conversation.deleteMany({ where: { OR: [{ user1Id: req.params.id }, { user2Id: req.params.id }] } });
      await tx.group.updateMany({ where: { createdById: req.params.id }, data: { createdById: null } });
      await tx.user.delete({ where: { id: req.params.id } });
    });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete user' }); }
});

router.post('/users/:id/reset-password', deviceAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, username: true, displayName: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const temporaryPassword = `Care${crypto.randomBytes(4).toString('hex')}`;
    const pending = await prisma.passwordResetRequest.findFirst({ where: { userId: user.id, status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(temporaryPassword), mustResetPassword: true } });
    if (pending) await prisma.passwordResetRequest.update({ where: { id: pending.id }, data: { status: 'RESOLVED', temporaryPassword, resolvedAt: new Date() } });
    else await prisma.passwordResetRequest.create({ data: { userId: user.id, usernameSnapshot: user.username, status: 'RESOLVED', temporaryPassword, resolvedAt: new Date() } });
    res.json({ success: true, username: user.username, temporaryPassword });
  } catch (err) { console.error('Failed to reset password:', err); res.status(500).json({ error: 'Failed to reset password' }); }
});

// Ban / Unban users
router.post('/users/:id/ban', deviceAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: true, isOnline: false }
    });
    res.json({ message: "User banned", user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post('/users/:id/unban', deviceAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: false }
    });
    res.json({ message: "User unbanned", user });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// Mute / Unmute users
router.post('/users/:id/mute', deviceAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isMuted: true }
    });
    res.json({ message: "User muted", user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post('/users/:id/unmute', deviceAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isMuted: false }
    });
    res.json({ message: "User unmuted", user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// Deposit and withdrawal moderation
router.get('/deposits', deviceAuth, async (req, res) => {
  try {
    const requests = await prisma.depositRequest.findMany({
      include: { user: { select: { id: true, username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ requests });
  } catch (err) {
    console.error('Failed to load deposits:', err);
    res.status(500).json({ error: 'Failed to load deposits' });
  }
});

router.get('/withdraws', deviceAuth, async (req, res) => {
  try {
    const requests = await prisma.withdrawRequest.findMany({
      include: { user: { select: { id: true, username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ requests });
  } catch (err) {
    console.error('Failed to load withdrawals:', err);
    res.status(500).json({ error: 'Failed to load withdrawals' });
  }
});

router.post('/deposits/:id/approve', deviceAuth, async (req, res) => {
  try {
    const request = await prisma.depositRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Deposit not found' });
    if (request.status.toLowerCase() !== 'pending') return res.status(400).json({ error: 'Request already processed' });
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.depositRequest.update({
        where: { id: request.id },
        data: { status: 'approved', adminNote: req.body.adminNote || null }
      });
      await tx.user.update({ where: { id: request.userId }, data: { coinBalance: { increment: request.amount } } });
      return updated;
    });
    res.json({ message: 'Deposit approved', request: result });
  } catch (err) {
    console.error('Failed to approve deposit:', err);
    res.status(500).json({ error: 'Failed to approve deposit' });
  }
});

router.post('/deposits/:id/reject', deviceAuth, async (req, res) => {
  try {
    const request = await prisma.depositRequest.update({
      where: { id: req.params.id },
      data: { status: 'rejected', adminNote: req.body.adminNote || null }
    });
    res.json({ message: 'Deposit rejected', request });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject deposit' });
  }
});

router.post('/withdraws/:id/approve', deviceAuth, async (req, res) => {
  try {
    const request = await prisma.withdrawRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Withdrawal not found' });
    if (request.status.toLowerCase() !== 'pending') return res.status(400).json({ error: 'Request already processed' });
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: request.userId } });
      if (!user || user.coinBalance < request.amount) throw new Error('Insufficient balance');
      const updated = await tx.withdrawRequest.update({
        where: { id: request.id },
        data: { status: 'approved', adminNote: req.body.adminNote || null }
      });
      await tx.user.update({ where: { id: request.userId }, data: { coinBalance: { decrement: request.amount } } });
      return updated;
    });
    res.json({ message: 'Withdrawal approved', request: result });
  } catch (err) {
    console.error('Failed to approve withdrawal:', err);
    res.status(400).json({ error: err.message === 'Insufficient balance' ? err.message : 'Failed to approve withdrawal' });
  }
});

router.post('/withdraws/:id/reject', deviceAuth, async (req, res) => {
  try {
    const request = await prisma.withdrawRequest.update({
      where: { id: req.params.id },
      data: { status: 'rejected', adminNote: req.body.adminNote || null }
    });
    res.json({ message: 'Withdrawal rejected', request });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

router.post('/users/:id/coins', deviceAuth, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const type = req.body.type === 'remove' ? 'remove' : 'add';
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (type === 'remove' && user.coinBalance < amount) return res.status(400).json({ error: 'Insufficient balance' });
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { coinBalance: type === 'add' ? { increment: amount } : { decrement: amount } }
    });
    res.json({ message: 'Balance updated', user: sanitizeUser(updated) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

module.exports = router;
