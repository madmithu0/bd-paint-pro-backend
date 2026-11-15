const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Material name is required'],
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: 'Standard',
    },
    unit: {
      type: String,
      default: 'Liter',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Material', materialSchema);
