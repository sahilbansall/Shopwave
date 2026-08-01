// ============================================================
// db.js - MongoDB connection and product seeding
//
// Product data is pulled LIVE from DummyJSON (https://dummyjson.com), a free
// public API built specifically for e-commerce demos/prototypes, so every
// product has a real name, brand, price, rating, and photo.
//
// DummyJSON doesn't have Books / Toys & Baby / Pet Supplies categories, so
// those three are filled in with a synthetic generator instead.
// ============================================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Product = require('./models/Product');
const User = require('./models/User');
const Coupon = require('./models/Coupon');
try {
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore DNS setServers errors on restricted container environments
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shopwave';

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected (ShopWave)');
  }
}

const CATEGORY_MAP = {
  smartphones:          { category: 'Electronics', subcategory: 'Smartphones' },
  laptops:               { category: 'Electronics', subcategory: 'Laptops' },
  tablets:               { category: 'Electronics', subcategory: 'Tablets' },
  'mobile-accessories':  { category: 'Electronics', subcategory: 'Computer Accessories' },
  'mens-shirts':         { category: 'Fashion', subcategory: "Men's Clothing" },
  tops:                  { category: 'Fashion', subcategory: "Women's Clothing" },
  'womens-dresses':      { category: 'Fashion', subcategory: "Women's Clothing" },
  'mens-shoes':          { category: 'Fashion', subcategory: 'Footwear' },
  'womens-shoes':        { category: 'Fashion', subcategory: 'Footwear' },
  'mens-watches':        { category: 'Fashion', subcategory: 'Watches' },
  'womens-watches':      { category: 'Fashion', subcategory: 'Watches' },
  'womens-bags':         { category: 'Fashion', subcategory: 'Handbags' },
  'womens-jewellery':    { category: 'Fashion', subcategory: 'Jewelry' },
  sunglasses:            { category: 'Fashion', subcategory: 'Sunglasses' },
  beauty:                { category: 'Beauty & Personal Care', subcategory: 'Makeup' },
  fragrances:            { category: 'Beauty & Personal Care', subcategory: 'Perfumes' },
  'skin-care':           { category: 'Beauty & Personal Care', subcategory: 'Skincare' },
  furniture:             { category: 'Home & Kitchen', subcategory: 'Furniture' },
  'home-decoration':     { category: 'Home & Kitchen', subcategory: 'Home Decor' },
  'kitchen-accessories': { category: 'Home & Kitchen', subcategory: 'Kitchen Appliances' },
  groceries:             { category: 'Grocery', subcategory: 'Packaged Foods' },
  'sports-accessories':  { category: 'Sports & Fitness', subcategory: 'Outdoor Sports' },
  motorcycle:            { category: 'Automotive', subcategory: 'Bike Accessories' },
  vehicle:               { category: 'Automotive', subcategory: 'Car Accessories' }
};

const ICON_BY_CATEGORY = {
  Electronics: 'Electronics', Fashion: 'Fashion', 'Beauty & Personal Care': 'Beauty',
  'Home & Kitchen': 'Home', Grocery: 'Grocery', 'Sports & Fitness': 'Sports',
  Automotive: 'Auto', Books: 'Books', 'Toys & Baby': 'Toys', 'Pet Supplies': 'Pets'
};

async function fetchRealProducts() {
  const res = await fetch('https://dummyjson.com/products?limit=0');
  if (!res.ok) throw new Error('DummyJSON request failed: ' + res.status);
  const data = await res.json();
  return data.products.map(p => {
    const map = CATEGORY_MAP[p.category] || { category: 'Home & Kitchen', subcategory: p.category };
    const originalPrice = p.discountPercentage > 1 ? +(p.price / (1 - p.discountPercentage / 100)).toFixed(2) : 0;
    const badgeRoll = Math.random();
    const badge = p.stock === 0 ? null : p.discountPercentage > 15 ? 'sale' : badgeRoll > 0.85 ? 'hot' : badgeRoll > 0.72 ? 'new' : null;
    const badgeText = badge === 'hot' ? 'Hot' : badge === 'new' ? 'New' : badge === 'sale' ? `${Math.round(p.discountPercentage)}% OFF` : null;
    return {
      id: p.id,
      name: p.title,
      brand: p.brand || map.category,
      category: map.category,
      subcategory: map.subcategory,
      price: p.price,
      originalPrice,
      rating: +p.rating.toFixed(1),
      reviews: (p.reviews && p.reviews.length ? p.reviews.length * 137 : 0) + Math.floor(Math.random() * 900) + 20,
      badge, badgeText,
      emoji: ICON_BY_CATEGORY[map.category] || 'Product',
      photo: p.thumbnail,
      stock: p.stock,
      description: p.description,
      tags: p.tags && p.tags.length ? p.tags : [map.subcategory.toLowerCase()],
      colors: ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399'],
      sizes: map.subcategory === 'Footwear' ? ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'] : (map.category === 'Fashion' && (map.subcategory.includes('Clothing'))) ? ['S', 'M', 'L', 'XL'] : ['Standard'],
      images: (p.images && p.images.length ? p.images : [p.thumbnail])
    };
  });
}

function generateSynthetic(category, subcatDefs, count, startId) {
  const TAGS_POOL = ['bestseller', 'trending', 'premium', 'eco-friendly', 'limited-edition', 'handpicked', 'durable', 'giftable', 'everyday-use'];
  const icon = ICON_BY_CATEGORY[category] || 'Product';
  const products = [];
  let id = startId;
  for (let i = 0; i < count; i++) {
    const sub = subcatDefs[i % subcatDefs.length];
    const adj = sub.adj[Math.floor(i / subcatDefs.length) % sub.adj.length];
    const noun = sub.nouns[i % sub.nouns.length];
    const basePrice = +(9 + Math.random() * 200).toFixed(2);
    const hasDiscount = Math.random() > 0.4;
    const originalPrice = hasDiscount ? +(basePrice * (1 + Math.random() * 0.4)).toFixed(2) : 0;
    const rating = +(3.6 + Math.random() * 1.4).toFixed(1);
    const stock = Math.random() > 0.08 ? Math.floor(Math.random() * 60) : 0;
    const badgeRoll = Math.random();
    const badge = stock === 0 ? null : badgeRoll > 0.85 ? 'hot' : badgeRoll > 0.7 ? 'new' : badgeRoll > 0.55 ? 'sale' : null;
    const badgeText = badge === 'hot' ? 'Hot' : badge === 'new' ? 'New' : badge === 'sale' ? 'Sale' : null;
    products.push({
      id: id++,
      name: `${adj} ${noun}`,
      brand: category,
      category,
      subcategory: sub.name,
      price: basePrice,
      originalPrice,
      rating,
      reviews: Math.floor(Math.random() * 3000) + 15,
      badge, badgeText,
      emoji: icon,
      photo: null,
      stock,
      description: `${adj} ${noun} from our ${sub.name} range - quality checked and ready to ship.`,
      tags: [...TAGS_POOL].sort(() => 0.5 - Math.random()).slice(0, 3),
      colors: ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399'],
      sizes: ['Standard'],
      images: []
    });
  }
  return products;
}

function generateFallbackCategories(startId) {
  let id = startId;
  let all = [];

  const books = generateSynthetic('Books', [
    { name: 'Educational', adj: ['Illustrated', 'Complete', 'Essential'], nouns: ['Science Guide', 'Math Workbook', 'History Atlas'] },
    { name: 'Novels', adj: ['Bestselling', 'Classic', 'Modern'], nouns: ['Mystery Novel', 'Romance Novel', 'Thriller Novel'] },
    { name: 'Comics', adj: ['Deluxe', "Collector's", 'Junior'], nouns: ['Comic Anthology', 'Graphic Novel', 'Manga Volume'] },
    { name: 'Competitive Exams', adj: ['Complete', 'Updated', 'Practice'], nouns: ['Exam Guide', 'Mock Test Set', 'Reasoning Book'] },
    { name: 'Technology', adj: ['Practical', 'Modern', "Beginner's"], nouns: ['Programming Guide', 'AI Handbook', 'Web Dev Book'] },
    { name: 'Biography', adj: ['Inspiring', 'Bestselling', 'Illustrated'], nouns: ['Life Story', 'Memoir', 'Autobiography'] }
  ], 24, id); id += books.length; all = all.concat(books);

  const toys = generateSynthetic('Toys & Baby', [
    { name: 'Toys', adj: ['Fun', 'Colorful', 'Interactive'], nouns: ['Building Blocks Set', 'Remote Car', 'Puzzle'] },
    { name: 'Baby Care', adj: ['Gentle', 'Soft', 'Premium'], nouns: ['Baby Wipes Pack', 'Baby Lotion', 'Feeding Set'] },
    { name: 'School Supplies', adj: ['Durable', 'Colorful', 'Essential'], nouns: ['Pencil Box', 'School Bag', 'Notebook Set'] },
    { name: 'Games', adj: ['Classic', 'Family', 'Strategy'], nouns: ['Board Game', 'Card Game', 'Puzzle Game'] }
  ], 20, id); id += toys.length; all = all.concat(toys);

  const pets = generateSynthetic('Pet Supplies', [
    { name: 'Pet Food', adj: ['Premium', 'Nutritious', 'Everyday'], nouns: ['Dog Food Pack', 'Cat Food Pack', 'Pet Treats'] },
    { name: 'Toys', adj: ['Durable', 'Fun', 'Interactive'], nouns: ['Chew Toy', 'Squeaky Toy', 'Pet Ball'] },
    { name: 'Grooming', adj: ['Gentle', 'Professional', 'Easy-use'], nouns: ['Pet Shampoo', 'Grooming Brush', 'Nail Clipper'] },
    { name: 'Accessories', adj: ['Comfortable', 'Adjustable', 'Stylish'], nouns: ['Pet Collar', 'Pet Bed', 'Pet Carrier'] }
  ], 16, id); all = all.concat(pets);

  return all;
}

async function seedProducts() {
  const count = await Product.countDocuments();
  if (count > 0) return;

  let realProducts = [];
  try {
    realProducts = await fetchRealProducts();
    console.log(`Fetched ${realProducts.length} real products from DummyJSON`);
  } catch (err) {
    console.warn('Could not reach DummyJSON API (' + err.message + ') - using synthetic products only for those categories.');
  }

  const maxId = realProducts.reduce((m, p) => Math.max(m, p.id), 0);
  const fallbackProducts = generateFallbackCategories(maxId + 1);
  const products = [...realProducts, ...fallbackProducts];

  await Product.insertMany(products);
  const cats = [...new Set(products.map(p => p.category))];
  console.log(`Seeded ${products.length} products across ${cats.length} categories (${realProducts.length} with real photos)`);
}

async function seedAdmin() {
  const existing = await User.findOne({ email: 'admin@shopwave.com' });
  if (existing) return;
  const hashed = bcrypt.hashSync('admin123', 10);
  await User.create({
    id: 1,
    name: 'Admin',
    email: 'admin@shopwave.com',
    password: hashed,
    role: 'admin',
    points: 0,
    referral: 'SW-ADMIN',
    addresses: [],
    cart: []
  });
  console.log('Seeded default admin user: admin@shopwave.com / admin123');
}

async function seedCoupons() {
  const count = await Coupon.countDocuments();
  if (count > 0) return;
  await Coupon.insertMany([
    { code: 'WELCOME', pct: 15 },
    { code: 'SAVE10', pct: 10 },
    { code: 'SHOPWAVE', pct: 20 }
  ]);
}

async function initDB() {
  await connectDB();
  await seedCoupons();
  await seedProducts();
  await seedAdmin();
}

module.exports = { connectDB, initDB };