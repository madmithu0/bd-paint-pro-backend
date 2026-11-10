const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  transactions: [{
    type: {
      type: String,
      enum: ['add', 'withdraw', 'payment', 'refund'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    note: {
      type: String,
      default: ''
    },
    date: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);