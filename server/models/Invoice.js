const mongoose = require('mongoose');

const invoiceLineItemSchema = new mongoose.Schema(
  {
    serviceName: { type: String, required: true },
    sqft: { type: Number, required: true, min: 0 },
    coatCount: { type: Number, default: 2 },
    rate: { type: Number, required: true, min: 0 },
    subTotal: { type: Number, required: true, min: 0 },
    addedMidJob: { type: Boolean, default: false },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    itemizedServices: {
      type: [invoiceLineItemSchema],
      default: [],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalBill: {
      type: Number,
      default: 0,
    },
    materialCost: {
      type: Number,
      default: 0,
    },
    optionalVatAmount: {
      type: Number,
      default: 0,
    },
    netProfit: {
      type: Number,
      default: 0,
    },
    warrantyRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warranty',
      default: null,
    },
    pdfUrl: {
      type: String,
      default: '',
    },
    shareBreakup: {
      mistriShare: { type: Number, default: 0 },
      agentShare: { type: Number, default: 0 },
      platformShare: { type: Number, default: 0 },
      isMistriOnly: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.pre('save', function (next) {
  if (!this.totalBill && this.amount) this.totalBill = this.amount;
  if (!this.amount && this.totalBill) this.amount = this.totalBill;
  if (!this.netProfit && this.totalBill > 0) {
    this.netProfit = Math.max(0, this.totalBill - this.materialCost - this.optionalVatAmount);
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
