const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, unique: true },
  category: String,
  unit: String,
  price: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  image: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Material', MaterialSchema);
