const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sanitizeUser } = require('../utils/helpers');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

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

// Get Payment Info (Public for users to see)
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
    const qrCode = req.file ? `/uploads/${req.file.filename}` : undefined;

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

// All users list
router.get('/users', deviceAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, displayName: true, email: true,
        isOnline: true, isBanned: true, isMuted: true,
        coinBalance: true, role: true, createdAt: true, lastSeen: true
      }
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
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
