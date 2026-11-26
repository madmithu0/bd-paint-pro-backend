const mongoose = require('mongoose');

const PROTECTED_TARGETS = [
  'SUPER_ADMIN_VERIFY',
  'SUPER_ADMIN_GATE',
  'SUPER_ADMIN_LOGIN',
  'GLOBAL_KILL_ALL',
];

const killSchema = new mongoose.Schema(
  {
    killType: {
      type: String,
      enum: ['FEATURE', 'USER', 'VERSION', 'GOVT'],
      required: true,
    },
    target: {
      type: String,
      required: true,
      trim: true,
      index: true,
      validate: {
        validator: function (val) {
          return !PROTECTED_TARGETS.includes(String(val).toUpperCase());
        },
        message: 'SECURITY LOCK: Protected system target or Global Kill cannot be used.',
      },
    },
    status: {
      type: Boolean,
      default: false,
    },
    govtFeatureFlags: {
      autoVatEnabled: { type: Boolean, default: false },
      nbrBinMandateEnabled: { type: Boolean, default: false },
      govtAuditEnabled: { type: Boolean, default: false },
    },
    hotlineConfig: {
      number: { type: String, default: process.env.HOTLINE_NUMBER || '096XXXXXXXX' },
      isLive: { type: Boolean, default: true },
    },
    auditHistory: [
      {
        action: { type: String, required: true },
        changedBy: { type: String, default: 'SUPER_ADMIN' },
        reason: { type: String, default: '' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    reason: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: String,
      default: 'SUPER_ADMIN',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Kill', killSchema);
