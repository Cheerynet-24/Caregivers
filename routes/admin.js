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
  const token = req.headers['x-admin-device'] || req.body.deviceToken || req.query.token || req.body.password;
  const targetToken = process.env.ADMIN_DEVICE_TOKEN || process.env.ADMIN_PASSWORD || 'wai_yan_lin_wai_05_mail';

  if (token && String(token).trim() === String(targetToken).trim()) {
    return next();
  }
  return res.status(403).json({ error: "Unauthorized device" });
};

// Login route supporting device token / secret key
router.post('/login', (req, res) => {
  const token = req.body.password || req.body.deviceToken || req.headers['x-admin-device'];
  const targetToken = process.env.ADMIN_DEVICE_TOKEN || process.env.ADMIN_PASSWORD || 'wai_yan_lin_wai_05_mail';
  
  if (token && String(token).trim() === String(targetToken).trim()) {
    return res.json({ success: true, message: "Device authenticated" });
  }
  return res.status(401).json({ error: "Wrong password" });
});

// Get Payment Info (Public for users to see)
router.get('/payment-info', async (req, res) => {
  try {
    const info = await prisma.paymentInfo.findFirst();
    res.json(info || { method: '', accountName: '', phoneNumber: '' });
  } catch (err) {
    res.json({ method: '', accountName: '', phoneNumber: '' });
  }
});

// Save Payment Info (Admin Only)
router.post('/payment-info', deviceAuth, async (req, res) => {
  try {
    const { method, accountName, phoneNumber } = req.body;
    const existing = await prisma.paymentInfo.findFirst();
    let result;
    if (existing) {
      result = await prisma.paymentInfo.update({
        where: { id: existing.id },
        data: { method, accountName, phoneNumber }
      });
    } else {
      result = await prisma.paymentInfo.create({
        data: { method, accountName, phoneNumber }
      });
    }
    res.json({ success: true, message: "Payment info saved", result });
  } catch (err) {
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
    res.json(users);
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
    res.json({ message: "User unbanned", user: sanitizeUser(user) });
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

module.exports = router;

