const mongoose = require('mongoose');

const roleTermsSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      enum: ['Customer', 'Mistri', 'Agent', 'Merchant'],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Platform Terms & Conditions',
    },
    version: {
      type: String,
      required: true,
      trim: true,
      default: 'v3.8.0',
    },
    clauses: {
      type: [String],
      default: [],
    },
    commissionRatePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    antiPoachingPenaltyAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
      default: 'SA_2026_MASTER',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports =
  mongoose.models.RoleTerms || mongoose.model('RoleTerms', roleTermsSchema);
