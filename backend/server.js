// ============================================================
// server.js - ShopWave Backend Entry Point
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Product = require('./models/Product');
const { initDB } = require('./db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const couponRoutes = require('./routes/coupons');
const cartRoutes = require('./routes/cart');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/cart', cartRoutes);

app.get('/api/categories', async (req, res) => {
  const cats = await Product.distinct('category');
  res.json(cats);
});

app.get('/api/health', async (req, res) => {
  const count = await Product.countDocuments();
  res.json({ status: 'ok', message: 'ShopWave API is running', products: count });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (require.main === module) {
  initDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`ShopWave API running at http://localhost:${PORT}`);
        console.log('Admin login: admin@shopwave.com / admin123');
      });
    })
    .catch((err) => {
      console.error('Startup failed:', err.message);
    });
}

module.exports = app;