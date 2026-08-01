const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'shopwave_dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post('/register', async (req, res) => {
  const { name, email, password, referral } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  let bonusPoints = 100;
  if (referral) {
    const referrer = await User.findOne({ referral });
    if (referrer) bonusPoints = 200;
  }

  const hashed = bcrypt.hashSync(password, 10);
  const newUser = await User.create({
    id: Date.now(),
    name,
    email: email.toLowerCase(),
    password: hashed,
    role: 'user',
    points: bonusPoints,
    referral: 'SW-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    addresses: [],
    cart: []
  });

  const token = signToken(newUser);
  const safeUser = newUser.toObject();
  delete safeUser.password;
  res.status(201).json({ token, user: safeUser });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const match = bcrypt.compareSync(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

  const token = signToken(user);
  const safeUser = user.toObject();
  delete safeUser.password;
  res.json({ token, user: safeUser });
});

router.get('/me', verifyToken, async (req, res) => {
  const user = await User.findOne({ id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const safeUser = user.toObject();
  delete safeUser.password;
  res.json(safeUser);
});

router.post('/addresses', verifyToken, async (req, res) => {
  const { name, phone, line, city, pin } = req.body;
  if (!name || !phone || !line || !city || !pin) return res.status(400).json({ error: 'All address fields are required.' });
  const address = { id: Date.now(), name, phone, line, city, pin };
  await User.findOneAndUpdate({ id: req.user.id }, { $push: { addresses: address } });
  res.status(201).json(address);
});

router.delete('/addresses/:addressId', verifyToken, async (req, res) => {
  await User.findOneAndUpdate(
    { id: req.user.id },
    { $pull: { addresses: { id: +req.params.addressId } } }
  );
  res.json({ success: true });
});

const resetCodes = {};

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user) return res.status(404).json({ error: 'No account found with that email.' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  resetCodes[user.email] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };

  res.json({ message: 'Reset code generated (demo mode - no real email sent).', demoCode: code });
});

router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  const entry = resetCodes[(email || '').toLowerCase()];
  if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
    return res.status(400).json({ error: 'Invalid or expired reset code.' });
  }
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

  await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { password: bcrypt.hashSync(newPassword, 10) }
  );
  delete resetCodes[email.toLowerCase()];
  res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
});

module.exports = router;