const express = require('express');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

router.get('/', async (req, res) => {
  const user = await User.findOne({ id: req.user.id });
  res.json(user?.cart || []);
});

router.put('/', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array.' });
  await User.findOneAndUpdate({ id: req.user.id }, { cart: items });
  res.json({ success: true, cart: items });
});

router.delete('/', async (req, res) => {
  await User.findOneAndUpdate({ id: req.user.id }, { cart: [] });
  res.json({ success: true });
});

module.exports = router;