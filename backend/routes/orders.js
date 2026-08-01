const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  const { items, address, payMethod, giftwrap, discountPct, promoCode } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty.' });
  if (!address) return res.status(400).json({ error: 'Delivery address is required.' });

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal > 100 ? 0 : 9.99;
  const wrapFee = giftwrap ? 4.99 : 0;
  const discount = subtotal * ((discountPct || 0) / 100);
  const tax = (subtotal - discount) * 0.05;
  const total = +(subtotal + shipping + wrapFee - discount + tax).toFixed(2);

  for (const item of items) {
    const p = await Product.findOne({ id: item.id });
    if (p) {
      await Product.updateOne({ id: item.id }, { stock: Math.max(0, p.stock - item.qty) });
    }
  }

  const order = await Order.create({
    id: 'SW' + Date.now().toString().slice(-8),
    date: new Date().toLocaleDateString(),
    items, total, payMethod, address, giftwrap: !!giftwrap, promoCode: promoCode || null,
    status: 'processing',
    userEmail: req.user.email
  });

  const user = await User.findOne({ id: req.user.id });
  if (user) {
    await User.findOneAndUpdate({ id: req.user.id }, { points: (user.points || 0) + Math.round(total) });
  }

  res.status(201).json(order);
});

router.get('/', verifyToken, async (req, res) => {
  const list = await Order.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).lean();
  res.json(list);
});

router.get('/:id', verifyToken, async (req, res) => {
  const order = await Order.findOne({ id: req.params.id }).lean();
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.userEmail !== req.user.email && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized.' });
  res.json(order);
});

router.put('/:id/cancel', verifyToken, async (req, res) => {
  const order = await Order.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.userEmail !== req.user.email) return res.status(403).json({ error: 'Not authorized.' });
  order.status = 'cancelled';
  await order.save();
  res.json(order);
});

router.put('/:id/status', verifyToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const order = await Order.findOneAndUpdate({ id: req.params.id }, { status }, { new: true });
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
});

module.exports = router;