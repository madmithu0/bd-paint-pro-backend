const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['salary', 'material', 'transport', 'office', 'marketing', 'commission', 'vat', 'other'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank', 'bkash', 'nagad'],
    default: 'cash'
  },
  expenseDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  relatedJob: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  receiptUrl: {
    type: String
  },
  description: {
    type: String
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  month: {
    type: Number
  },
  year: {
    type: Number
  }
}, {
  timestamps: true
});

expenseSchema.pre('save', function(next) {
  const date = this.expenseDate || new Date();
  this.month = date.getMonth() + 1;
  this.year = date.getFullYear();
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);