const mongoose = require('mongoose');

const smsLogSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Queued', 'Sent', 'Failed'],
      default: 'Queued',
    },
    cost: {
      type: Number,
      default: 0.35, // BDT per SMS
    },
    gatewayResponse: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SmsLog', smsLogSchema);
