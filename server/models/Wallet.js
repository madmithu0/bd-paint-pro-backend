const mongoose = require('mongoose');

const transactionSubSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'EQUAL_SPLIT_CREDIT',
        'AGENT_COMMISSION',
        'MERCHANT_SETTLEMENT',
        'WITHDRAW',
        'REFUND_CREDIT',
        'ADD_MONEY',
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    method: {
      type: String,
      default: 'Wallet',
    },
    accountNumber: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Rejected'],
      default: 'Completed',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const merchantSettlementSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaterialOrder',
      default: null,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionDeducted: {
      type: Number,
      default: 0,
      min: 0,
    },
    netPayable: {
      type: Number,
      required: true,
      min: 0,
    },
    settledAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    verifiedWalletNumber: {
      type: String,
      trim: true,
      default: null,
    },
    walletProvider: {
      type: String,
      enum: ['bKash', 'Nagad', 'Rocket', 'Bank', null],
      default: null,
    },
    isWalletVerified: {
      type: Boolean,
      default: false,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
    },
    transactions: {
      type: [transactionSubSchema],
      default: [],
    },
    merchantSettlementLedger: {
      type: [merchantSettlementSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Wallet', walletSchema);
