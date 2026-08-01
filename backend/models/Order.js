const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  date: String,
  items: { type: Array, required: true },
  total: Number,
  payMethod: String,
  address: mongoose.Schema.Types.Mixed,
  giftwrap: { type: Boolean, default: false },
  promoCode: String,
  status: { type: String, default: 'processing' },
  userEmail: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);