const mongoose = require('mongoose');

const amcSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  planName: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    required: true
  },
  duration: {
    type: Number,
    required: true,
    comment: 'Duration in months'
  },
  price: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  servicesIncluded: [{
    type: String
  }],
  visitCount: {
    type: Number,
    default: 0
  },
  maxVisits: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  autoRenew: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AMC', amcSchema);