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
      enum: ['FEATURE', 'USER', 'VERSION', 'GOVT', 'MISTRI_SIGNUP'],
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
    // New Mistri Signup & Area Quota Controls (v3.8.1)
    newMistriSignupEnabled: {
      type: Boolean,
      default: true,
    },
    maxMistriPerUpazila: {
      type: Number,
      default: 0, // 0 means unlimited; set > 0 (e.g., 50) to enforce Upazila quota
      min: 0,
    },
    govtFeatureFlags: {
      autoVatEnabled: { type: Boolean, default: false },
      nbrBinMandateEnabled: { type: Boolean, default: false },
      govtAuditEnabled: { type: Boolean, default: false },
    },
    hotlineConfig: {
      number: { type: String, default: process.env.HOTLINE_NUMBER || '01885165203},
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
