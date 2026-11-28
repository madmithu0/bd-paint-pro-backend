const mongoose = require('mongoose');

const superAdminSecuritySchema = new mongoose.Schema(
  {
    superAdminId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: 'SA_2026_MASTER',
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    transactionPin: {
      type: String,
      default: '',
      trim: true,
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    allowedIps: {
      type: [String],
      default: [],
    },
    sessionTimeoutMinutes: {
      type: Number,
      default: 30,
      min: 5,
      max: 240,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: true,
    },
    failedAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports =
  mongoose.models.SuperAdminSecurity ||
  mongoose.model('SuperAdminSecurity', superAdminSecuritySchema);
