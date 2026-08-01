const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  productId: Number,
  name: String,
  userEmail: String,
  rating: Number,
  text: String,
  img: String,
  verified: Boolean,
  date: String
});

module.exports = mongoose.model('Review', reviewSchema);