const mongoose = require('mongoose');

const materialStoreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  ownerName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  area: {
    type: String,
    required: true
  },
  materials: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material'
  }],
  rating: {
    type: Number,
    default: 5
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  commissionRate: {
    type: Number,
    default: 10
  },
  totalSales: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MaterialStore', materialStoreSchema);