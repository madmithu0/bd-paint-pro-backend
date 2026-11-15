const mongoose = require('mongoose');

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
    amount: {
      type: Number,
      required: true,
      min: 0,
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

module.exports = mongoose.model('Invoice', invoiceSchema);
