const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      default: 'ANONYMOUS',
      index: true,
    },
    role: {
      type: String,
      default: 'Guest',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['AUTH', 'PASSWORD_RESET', 'VERSION_CHANGE', 'BIOMETRIC_FAIL', 'HIDE_TOGGLE', 'PAYMENT', 'ADMIN', 'GENERAL'],
      default: 'GENERAL',
    },
    ipAddress: {
      type: String,
      default: '0.0.0.0',
    },
    deviceInfo: {
      type: String,
      default: 'Unknown Device',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    time: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
