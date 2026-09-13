const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sanitizeUser } = require('../utils/helpers');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Device Token / Secret Authentication Middleware
const deviceAuth = (req, res, next) => {
  const token = req.headers['x-admin-device'] || req.query.token || req.body.deviceToken || req.body.password;
  const targetToken = process.env.ADMIN_DEVICE_TOKEN || process.env.ADMIN_PASSWORD || '29580284';

  if (token && String(token).trim() === String(targetToken).trim()) {
    return next();
  }
  return res.status(403).json({ error: "Unauthorized device" });
};

// Login route supporting device token / secret key
router.post('/login', (req, res) => {
  const token = req.body.password || req.body.deviceToken || req.headers['x-admin-device'];
  const targetToken = process.env.ADMIN_DEVICE_TOKEN || process.env.ADMIN_PASSWORD || '29580284';
  
  if (token && String(token).trim() === String(targetToken).trim()) {
    return res.json({ success: true, message: "Device authenticated" });
  }
  return res.status(401).json({ error: "Wrong password" });
});

// All users
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

// Ban / Unban
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

// Mute / Unmute
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

