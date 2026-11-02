const mongoose = require('mongoose');

const materialStockSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialStore',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  unit: {
    type: String,
    required: true,
    default: 'pcs'
  },
  purchasePrice: {
    type: Number,
    required: true
  },
  sellingPrice: {
    type: Number,
    required: true
  },
  lowStockAlert: {
    type: Number,
    default: 10
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

materialStockSchema.index({ materialId: 1, storeId: 1 }, { unique: true });

module.exports = mongoose.model('MaterialStock', materialStockSchema);