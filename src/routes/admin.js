const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const adminAuth = require('../middleware/auth');
const { sanitizeUser } = require('../utils/helpers');

// Multer storage configuration for uploads if needed
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Admin Login check with debugging & trim
router.post('/login', (req, res) => {
  const password = req.body.password || req.body.adminPassword || req.body.pass;
  const targetPassword = process.env.ADMIN_PASSWORD || '29580284';
  
  console.log("DEBUG LOGIN -> Received:", JSON.stringify(password), "Target:", JSON.stringify(targetPassword));
  
  if (password && targetPassword && String(password).trim() === String(targetPassword).trim()) {
    return res.json({ success: true, message: "Admin authenticated" });
  }
  return res.status(401).json({ error: "Wrong password" });
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
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// Ban / Unban
router.post('/users/:id/ban', adminAuth, async (req, res) => {
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

router.post('/users/:id/unban', adminAuth, async (req, res) => {
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
router.post('/users/:id/mute', adminAuth, async (req, res) => {
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

router.post('/users/:id/unmute', adminAuth, async (req, res) => {
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

