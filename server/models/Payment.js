const mongoose = require('mongoose');
const PaymentSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  amount: Number,
  method: { type: String, enum: ['bkash','nagad','bank'] },
  status: { type: String, enum: ['pending','completed','failed'], default: 'pending' },
  trxId: String
}, { timestamps: true });
module.exports = mongoose.model('Payment', PaymentSchema);