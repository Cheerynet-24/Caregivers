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
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashed,
        displayName: displayName || username,
        email: email || null,
        coinBalance: 100 // Welcome bonus test coins
      }
    });

    const token = generateToken(user);
    res.status(201).json({
      message: 'Registered successfully',
      token,
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

// Logout (set offline)
router.post('/logout', auth, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { isOnline: false, lastSeen: new Date() }
  });
  res.json({ message: 'Logged out' });
});

module.exports = router;
