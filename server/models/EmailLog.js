const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Queued', 'Sent', 'Failed'],
      default: 'Queued',
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('EmailLog', emailLogSchema);
