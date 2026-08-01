const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  id: Number,
  name: String,
  phone: String,
  line: String,
  city: String,
  pin: String
}, { _id: false });

const userSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  name: String,
  email: { type: String, unique: true, required: true, lowercase: true },
  password: String,
  role: { type: String, default: 'user' },
  points: { type: Number, default: 0 },
  referral: String,
  addresses: [addressSchema],
  cart: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);