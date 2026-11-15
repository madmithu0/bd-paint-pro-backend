const mongoose = require('mongoose');

const transactionSubSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['EQUAL_SPLIT_CREDIT', 'AGENT_COMMISSION', 'WITHDRAW', 'REFUND_CREDIT', 'ADD_MONEY'],
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

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Wallet', walletSchema);
