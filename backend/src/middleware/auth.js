const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'caregivers-secret');
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.isBanned) {
      return res.status(401).json({ error: 'Unauthorized or banned' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminAuth = async (req, res, next) => {
  // Simple password based admin for this demo
  const adminPass = req.headers['x-admin-password'] || req.body?.adminPassword;
  if (adminPass === (process.env.ADMIN_PASSWORD || '29580284')) {
    req.isAdmin = true;
    return next();
  }
  // Also allow JWT if user.role === 'admin'
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'caregivers-secret');
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (user && user.role === 'admin') {
        req.user = user;
        req.isAdmin = true;
        return next();
      }
    }
  } catch (e) {}
  return res.status(403).json({ error: 'Admin access required' });
};

module.exports = { auth, adminAuth };
