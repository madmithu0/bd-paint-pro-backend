const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['bkash', 'nagad', 'rocket', 'bank', 'cash'],
    required: true
  },
  trxId: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);