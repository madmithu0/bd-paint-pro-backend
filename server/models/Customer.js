const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  customerCode: {
    type: String,
    unique: true
  },
  address: {
    type: String,
    required: true
  },
  area: {
    type: String
  },
  totalJobs: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 5
  },
  isPremium: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Customer', customerSchema);