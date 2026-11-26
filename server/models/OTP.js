const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    referenceId: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      default: null,
    },
    code: {
      type: String,
      default: null,
    },
    provider: {
      type: String,
      enum: ['FIREBASE_PHONE', 'GMAIL_SMTP', 'TELEGRAM_BOT', 'SMS_GATEWAY', 'LOCAL'],
      default: 'GMAIL_SMTP',
    },
    firebaseUid: {
      type: String,
      default: null,
    },
    purpose: {
      type: String,
      enum: [
        'LOGIN',
        'SIGNUP',
        'FORGOT_PASSWORD',
        'PASSWORD_RESET',
        'WALLET_VERIFY',
        'MATERIAL_MEMO',
        'ADDON_CONTRACT',
        'SUPER_ADMIN_PHONE',
        'SUPER_ADMIN_GMAIL',
        'SUPER_ADMIN_2FA',
        'CONTRACT_SIGN',
      ],
      default: 'LOGIN',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OTP', otpSchema);
