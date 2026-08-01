const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken, requireAdmin);

router.get('/stats', async (req, res) => {
  const orders = await Order.find().lean();
  const products = await Product.find().lean();
  const users = await User.find().lean();
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  const days = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d;
  });
  const dayTotals = days.map(d => {
    const key = d.toLocaleDateString();
    return orders.filter(o => o.date === key).reduce((s, o) => s + o.total, 0);
  });

  res.json({
    revenue,
    totalOrders: orders.length,
    totalUsers: users.length,
    lowStockCount: products.filter(p => p.stock > 0 && p.stock <= 5).length,
    outOfStockCount: products.filter(p => p.stock === 0).length,
    weeklySales: days.map((d, i) => ({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), total: dayTotals[i] }))
  });
});

router.get('/orders', async (req, res) => {
  res.json(await Order.find().sort({ createdAt: -1 }).lean());
});

router.get('/users', async (req, res) => {
  const users = await User.find().lean();
  res.json(users.map(({ password, ...rest }) => rest));
});

module.exports = router;