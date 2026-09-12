const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { adminAuth } = require('../middleware/auth');
const { sanitizeUser } = require('../utils/helpers');

const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `admin-${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Simple login check for admin panel (password only)
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === (process.env.ADMIN_PASSWORD || '29580284')) {
    return res.json({ success: true, message: 'Admin authenticated' });
  }
  return res.status(401).json({ error: 'Wrong password' });
});

// All users
router.get('/users', adminAuth, async (req, res) => {
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
    res.status(500).json({ error: 'Failed' });
  }
});

// Ban / Unban
router.post('/users/:id/ban', adminAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: true, isOnline: false }
    });
    res.json({ message: 'User banned', user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/users/:id/unban', adminAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: false }
    });
    res.json({ message: 'User unbanned', user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Mute / Unmute
router.post('/users/:id/mute', adminAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isMuted: true }
    });
    res.json({ message: 'User muted', user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/users/:id/unmute', adminAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isMuted: false }
    });
    res.json({ message: 'User unmuted', user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Adjust coins
router.post('/users/:id/coins', adminAuth, async (req, res) => {
  try {
    const { amount, type, description } = req.body; // type: add | remove
    const amt = parseInt(amount, 10);
    if (!amt || amt < 1) return res.status(400).json({ error: 'Invalid amount' });

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let newBalance = user.coinBalance;
    if (type === 'add') newBalance += amt;
    else if (type === 'remove') {
      newBalance = Math.max(0, newBalance - amt);
    } else {
      return res.status(400).json({ error: 'type must be add or remove' });
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { coinBalance: newBalance }
      }),
      prisma.transaction.create({
        data: {
          userId: user.id,
          type: type === 'add' ? 'admin_add' : 'admin_remove',
          amount: amt,
          status: 'completed',
          description: description || `Admin ${type}`
        }
      })
    ]);
    res.json({ message: 'Coins updated', balance: updated.coinBalance });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Deposit requests
router.get('/deposits', adminAuth, async (req, res) => {
  try {
    const requests = await prisma.depositRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, displayName: true } }
      }
    });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/deposits/:id/approve', adminAuth, async (req, res) => {
  try {
    const request = await prisma.depositRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    await prisma.$transaction([
      prisma.depositRequest.update({
        where: { id: request.id },
        data: { status: 'approved', adminNote: req.body.adminNote || null }
      }),
      prisma.user.update({
        where: { id: request.userId },
        data: { coinBalance: { increment: request.amount } }
      }),
      prisma.transaction.create({
        data: {
          userId: request.userId,
          type: 'deposit',
          amount: request.amount,
          status: 'completed',
          description: 'Deposit approved'
        }
      })
    ]);
    res.json({ message: 'Deposit approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/deposits/:id/reject', adminAuth, async (req, res) => {
  try {
    await prisma.depositRequest.update({
      where: { id: req.params.id },
      data: { status: 'rejected', adminNote: req.body.adminNote || null }
    });
    res.json({ message: 'Deposit rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Withdraw requests
router.get('/withdraws', adminAuth, async (req, res) => {
  try {
    const requests = await prisma.withdrawRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, displayName: true, coinBalance: true } }
      }
    });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/withdraws/:id/approve', adminAuth, async (req, res) => {
  try {
    const request = await prisma.withdrawRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    if (user.coinBalance < request.amount) {
      return res.status(400).json({ error: 'User has insufficient balance' });
    }

    await prisma.$transaction([
      prisma.withdrawRequest.update({
        where: { id: request.id },
        data: { status: 'approved', adminNote: req.body.adminNote || null }
      }),
      prisma.user.update({
        where: { id: request.userId },
        data: { coinBalance: { decrement: request.amount } }
      }),
      prisma.transaction.create({
        data: {
          userId: request.userId,
          type: 'withdraw',
          amount: request.amount,
          status: 'completed',
          description: 'Withdraw approved'
        }
      })
    ]);
    res.json({ message: 'Withdraw approved. Please transfer money to user manually.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/withdraws/:id/reject', adminAuth, async (req, res) => {
  try {
    await prisma.withdrawRequest.update({
      where: { id: req.params.id },
      data: { status: 'rejected', adminNote: req.body.adminNote || null }
    });
    res.json({ message: 'Withdraw rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Payment info (bank details for users to transfer to)
router.get('/payment-info', adminAuth, async (req, res) => {
  try {
    const settings = await prisma.siteSetting.findMany();
    const info = {};
    settings.forEach(s => { info[s.key] = s.value; });
    res.json({ paymentInfo: info });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/payment-info', adminAuth, upload.single('qr_image'), async (req, res) => {
  try {
    const fields = ['bank_name', 'account_name', 'phone_number', 'instructions'];
    for (const key of fields) {
      if (req.body[key] !== undefined) {
        await prisma.siteSetting.upsert({
          where: { key },
          update: { value: req.body[key] },
          create: { key, value: req.body[key] }
        });
      }
    }
    if (req.file) {
      const qrPath = `/uploads/${req.file.filename}`;
      await prisma.siteSetting.upsert({
        where: { key: 'qr_image' },
        update: { value: qrPath },
        create: { key: 'qr_image', value: qrPath }
      });
    }
    res.json({ message: 'Payment info updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
