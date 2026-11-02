const mongoose = require('mongoose');

const materialRequestSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  mistriId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mistri',
    required: true
  },
  materials: [{
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    estimatedPrice: {
      type: Number
    }
  }],
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialStore'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'purchased', 'delivered', 'cancelled'],
    default: 'pending'
  },
  totalEstimatedCost: {
    type: Number
  },
  totalActualCost: {
    type: Number
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerApproved: {
    type: Boolean,
    default: false
  },
  billUrl: {
    type: String
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MaterialRequest', materialRequestSchema);