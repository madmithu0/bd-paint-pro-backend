const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
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
      default: null, // Optional when verified directly via Firebase ID Token
    },
    provider: {
      type: String,
      enum: ['FIREBASE_PHONE', 'GMAIL_SMTP', 'TELEGRAM_BOT', 'LOCAL'],
      default: 'GMAIL_SMTP',
    },
    firebaseUid: {
      type: String,
      default: null,
    },
    purpose: {
      type: String,
      enum: ['LOGIN', 'SIGNUP', 'FORGOT_PASSWORD', 'SUPER_ADMIN_PHONE', 'SUPER_ADMIN_GMAIL', 'CONTRACT_SIGN'],
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
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes validity
      index: { expires: 0 }, // MongoDB TTL index automatically deletes expired OTPs
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OTP', otpSchema);
