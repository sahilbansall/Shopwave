const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  name: String,
  brand: String,
  category: String,
  subcategory: String,
  price: Number,
  originalPrice: Number,
  rating: Number,
  reviews: Number,
  badge: String,
  badgeText: String,
  emoji: String,
  photo: String,
  stock: { type: Number, default: 0 },
  description: String,
  tags: [String],
  colors: [String],
  sizes: [String],
  images: [String]
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);