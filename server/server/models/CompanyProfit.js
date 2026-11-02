const mongoose = require('mongoose');

const companyProfitSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NBRInvoice'
  },
  type: {
    type: String,
    enum: ['job_commission', 'material_profit', 'amc_profit', 'vat_profit', 'other'],
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  costAmount: {
    type: Number,
    default: 0
  },
  profitAmount: {
    type: Number,
    required: true
  },
  profitPercentage: {
    type: Number
  },
  month: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  description: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CompanyProfit', companyProfitSchema);