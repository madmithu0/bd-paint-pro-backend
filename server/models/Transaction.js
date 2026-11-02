const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mistriId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: String,
  amount: { type: Number, required: true },
  description: String,
  paymentMethod: { type: String, enum: ['cash', 'bkash', 'nagad', 'bank'], default: 'cash' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
