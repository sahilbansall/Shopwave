const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true, uppercase: true },
  pct: Number
});

module.exports = mongoose.model('Coupon', couponSchema);