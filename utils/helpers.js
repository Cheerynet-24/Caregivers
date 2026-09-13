const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'caregivers-secret',
    { expiresIn: '7d' }
  );
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  if (typeof safe.avatar === 'string' && safe.avatar.length > 150000) safe.avatar = null;
  return safe;
};

const compactUser = (user) => {
  if (!user) return user;
  const copy = { ...user };
  if (typeof copy.avatar === 'string' && copy.avatar.length > 150000) copy.avatar = null;
  return copy;
};

module.exports = { hashPassword, comparePassword, generateToken, sanitizeUser, compactUser };
