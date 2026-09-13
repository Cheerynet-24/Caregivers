const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// Get balance + history
router.get('/', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { coinBalance: true }
    });
    const deposits = await prisma.depositRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const withdraws = await prisma.withdrawRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json({
      balance: user.coinBalance,
      transactions: [],
      depositRequests: deposits,
      withdrawRequests: withdraws
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Create deposit request (with optional screenshot)
router.post('/deposit', auth, upload.single('screenshot'), async (req, res) => {
  try {
    const amount = parseInt(req.body.amount, 10);
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const screenshot = req.file ? `/uploads/${req.file.filename}` : null;
    const note = req.body.note || null;
    const selectedAccount = req.body.accountId
      ? await prisma.paymentAccount.findFirst({ where: { id: req.body.accountId, isActive: true } })
      : await prisma.paymentAccount.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    const paymentInfo = selectedAccount || await prisma.paymentInfo.findFirst();

    const request = await prisma.depositRequest.create({
      data: {
        userId: req.user.id,
        paymentAccountId: selectedAccount?.id || null,
        method: paymentInfo?.method || null,
        accountName: paymentInfo?.accountName || null,
        phoneNumber: paymentInfo?.phoneNumber || null,
        amount,
        screenshot,
        note
      }
    });
    res.status(201).json({ message: 'Deposit request submitted', request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Create withdraw request
router.post('/withdraw', auth, upload.single('qrCode'), async (req, res) => {
  try {
    const amount = parseInt(req.body.amount, 10);
    const { accountName, phoneNumber, bankName, note } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (!accountName || !phoneNumber) {
      return res.status(400).json({ error: 'Account Name and Phone Number required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.coinBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const qrCode = req.file ? `/uploads/${req.file.filename}` : null;

    // Hold the coins (optional: deduct now or on approve)
    // For simplicity we deduct on approve only. Check balance here.

    const request = await prisma.withdrawRequest.create({
      data: {
        userId: req.user.id,
        method: bankName || null,
        amount,
        accountName,
        phoneNumber,
        bankName: bankName || null,
        qrCode,
        note: note || null
      }
    });
    res.status(201).json({ message: 'Withdraw request submitted', request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Get site payment info (bank details set by admin)
router.get('/payment-info', auth, async (req, res) => {
  try {
    const accounts = await prisma.paymentAccount.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    const legacy = accounts.length ? null : await prisma.paymentInfo.findFirst();
    const fallback = legacy || { method: '', accountName: '', phoneNumber: '', qrCode: '', instructions: '' };
    res.json({ paymentInfo: fallback, paymentAccounts: accounts });
  } catch (err) {
    console.error('Failed to load payment info:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
