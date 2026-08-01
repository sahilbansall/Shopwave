const express = require('express');
const Coupon = require('../models/Coupon');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  res.json(await Coupon.find().lean());
});

router.post('/apply', async (req, res) => {
  const { code } = req.body;
  const coupon = await Coupon.findOne({ code: (code || '').toUpperCase() }).lean();
  if (!coupon) return res.status(404).json({ error: 'Invalid promo code.' });
  res.json(coupon);
});

router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { code, pct } = req.body;
  if (!code || !pct) return res.status(400).json({ error: 'Code and percentage are required.' });
  const coupon = await Coupon.create({ code: code.toUpperCase(), pct: +pct });
  res.status(201).json(coupon);
});

router.delete('/:code', verifyToken, requireAdmin, async (req, res) => {
  await Coupon.deleteOne({ code: req.params.code.toUpperCase() });
  res.json({ success: true });
});

module.exports = router;