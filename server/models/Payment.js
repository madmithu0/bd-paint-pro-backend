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
    paymentType: {
      type: String,
      enum: ['Full', 'Advance30', 'Advance50', 'Remaining'],
      default: 'Full',
    },
    method: {
      type: String,
      enum: ['Bkash', 'Nagad', 'Rocket', 'Bank', 'Wallet'],
      required: true,
    },
    trxId: {
      type: String,
      required: true,
      unique: true, // Prevents Duplicate TrxID fraud
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'EscrowHeld', 'Verified', 'Released', 'Failed', 'Refunded'],
      default: 'Pending',
      index: true,
    },
    // Auto Calculated Share Amounts in BDT
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

module.exports = mongoose.model('Payment', paymentSchema);
