const express = require('express');
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/products?category=&search=&sort=&page=&limit=&instock=
router.get('/', (req, res) => {
  let list = db.get('products').value();
  const { category, subcategory, search, sort, instock, maxPrice } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 12);

  if (category && category !== 'all') list = list.filter(p => p.category === category);
  if (subcategory) list = list.filter(p => p.subcategory === subcategory);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)));
  }
  if (instock === 'true') list = list.filter(p => p.stock > 0);
  if (maxPrice) list = list.filter(p => p.price <= parseFloat(maxPrice));

  if (sort === 'price-asc') list = list.slice().sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') list = list.slice().sort((a, b) => b.price - a.price);
  else if (sort === 'rating') list = list.slice().sort((a, b) => b.rating - a.rating);
  else if (sort === 'reviews') list = list.slice().sort((a, b) => b.reviews - a.reviews);
  else if (sort === 'discount') list = list.slice().sort((a, b) => ((b.originalPrice ? 1 - b.price / b.originalPrice : 0)) - ((a.originalPrice ? 1 - a.price / a.originalPrice : 0)));

  const total = list.length;
  const start = (page - 1) * limit;
  const paged = list.slice(start, start + limit);

  res.json({ products: paged, total, page, limit, totalPages: Math.ceil(total / limit) });
});

// GET /api/products/meta/subcategories?category=Fashion
router.get('/meta/subcategories', (req, res) => {
  const { category } = req.query;
  let list = db.get('products').value();
  if (category && category !== 'all') list = list.filter(p => p.category === category);
  const subs = [...new Set(list.map(p => p.subcategory).filter(Boolean))];
  res.json(subs);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.get('products').find({ id: +req.params.id }).value();
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
});

// POST /api/products (admin only)
router.post('/', verifyToken, requireAdmin, (req, res) => {
  const products = db.get('products');
  const nextId = (products.value().reduce((m, p) => Math.max(m, p.id), 0)) + 1;
  const product = { id: nextId, stock: 0, rating: 0, reviews: 0, tags: [], colors: [], sizes: ['Standard'], images: [req.body.emoji || '📦'], ...req.body, id: nextId };
  products.push(product).write();
  res.status(201).json(product);
});

// PUT /api/products/:id (admin only)
router.put('/:id', verifyToken, requireAdmin, (req, res) => {
  const product = db.get('products').find({ id: +req.params.id });
  if (!product.value()) return res.status(404).json({ error: 'Product not found.' });
  product.assign(req.body).write();
  res.json(product.value());
});

// DELETE /api/products/:id (admin only)
router.delete('/:id', verifyToken, requireAdmin, (req, res) => {
  db.get('products').remove({ id: +req.params.id }).write();
  res.json({ success: true });
});

// ---- Reviews (nested under product) ----
// GET /api/products/:id/reviews
router.get('/:id/reviews', (req, res) => {
  const list = db.get('reviews').filter({ productId: +req.params.id }).value();
  res.json(list);
});

// POST /api/products/:id/reviews (auth required)
router.post('/:id/reviews', verifyToken, (req, res) => {
  const { rating, text, img } = req.body;
  if (!rating || !text) return res.status(400).json({ error: 'Rating and review text are required.' });

  const verified = db.get('orders').value().some(o => o.userEmail === req.user.email && o.items.some(i => i.id === +req.params.id));
  const review = {
    id: Date.now(),
    productId: +req.params.id,
    name: req.user.name,
    userEmail: req.user.email,
    rating: +rating,
    text,
    img: img || null,
    verified,
    date: new Date().toLocaleDateString()
  };
  db.get('reviews').push(review).write();
  res.status(201).json(review);
});

module.exports = router;
