const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [1, 'Amount must be at least 1 BDT'],
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    materialCost: {
      type: Number,
      default: 0,
    },
    vatAmount: {
      type: Number,
      default: 0,
    },
    netProfit: {
      type: Number,
      default: 0,
    },
    merchantCommission: {
      type: Number,
      default: 0,
    },
    dealerMargin: {
      type: Number,
      default: 0,
    },
    milestoneStage: {
      type: String,
      enum: ['30%', '40%', '30%', 'AddOn30', 'Full'],
      default: '30%',
    },
    paymentType: {
      type: String,
      enum: ['Full', 'Advance30', 'Advance40', 'Remaining30', 'Advance50', 'Remaining', 'AddOn30'],
      default: 'Advance30',
    },
    method: {
      type: String,
      enum: ['Bkash', 'Nagad', 'Rocket', 'Bank', 'Wallet'],
      required: true,
    },
    trxId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'EscrowHeld', 'Verified', 'Released', 'Failed', 'Refunded'],
      default: 'Pending',
      index: true,
    },
    mistriShareAmount: {
      type: Number,
      default: 0,
    },
    agentShareAmount: {
      type: Number,
      default: 0,
    },
    platformShareAmount: {
      type: Number,
      default: 0,
    },
    payoutDistributed: {
      type: Boolean,
      default: false,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.pre('save', function (next) {
  if (!this.totalAmount && this.amount) this.totalAmount = this.amount;
  if (!this.amount && this.totalAmount) this.amount = this.totalAmount;
  if (!this.netProfit && this.totalAmount > 0) {
    this.netProfit = Math.max(0, this.totalAmount - this.materialCost - this.vatAmount);
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
