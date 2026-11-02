const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  agentCode: {
    type: String,
    required: true,
    unique: true
  },
  nidNumber: {
    type: String,
    required: true
  },
  area: {
    type: String,
    required: true
  },
  commissionRate: {
    type: Number,
    default: 5
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalJobs: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 5
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Agent', agentSchema);