const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedMistri: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    assignedTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    sqft: {
      type: Number,
      required: [true, 'Square feet (Sqft) is required'],
      min: [1, 'Sqft must be greater than 0'],
    },
    price: {
      type: Number,
      required: [true, 'Total job price is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Assigned', 'In-Progress', 'Completed', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    materialSource: {
      type: String,
      enum: ['Platform', 'CustomerOwn', 'Merchant'],
      default: 'Platform',
    },
    materialCost: {
      type: Number,
      default: 0,
    },
    labourCost: {
      type: Number,
      default: 0,
    },
    isMistriOnly: {
      type: Boolean,
      default: false,
    },
    // 450 Sqft Per Day Calculation Lock (100 Sqft = 0.22 Day)
    perDayCapacity: {
      type: Number,
      default: 450,
      immutable: true,
    },
    totalDays: {
      type: Number,
      default: 0,
    },
    mistriCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    // Wall Condition & AI Measurement Data
    wallProblem: {
      type: [String],
      enum: ['None', 'Nona', 'Damp', 'Fatol'],
      default: ['None'],
    },
    wallDamageLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Severe'],
      default: 'Low',
    },
    wallPhotos: {
      type: [String],
      default: [],
    },
    // Auto Revenue Share Split Percentages
    hasAgent: {
      type: Boolean,
      default: false,
    },
    mistriSharePercent: {
      type: Number,
      default: 80,
    },
    agentSharePercent: {
      type: Number,
      default: 0,
    },
    platformSharePercent: {
      type: Number,
      default: 20,
    },
    // Job Start & End OTP Security
    startOtp: {
      type: String,
      default: null,
    },
    endOtp: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate 450 Sqft Days, Mistri-Only Cost & Share Split before saving
jobSchema.pre('save', function (next) {
  // 1. 450 Sqft Day Formula
  const rawDays = this.sqft / 450;
  this.totalDays = Number((rawDays / Math.max(1, this.mistriCount)).toFixed(2));

  // 2. Mistri-Only Check (Material Cost = 0 if customer provides paint)
  if (this.isMistriOnly || this.materialSource === 'CustomerOwn') {
    this.isMistriOnly = true;
    this.materialCost = 0;
  }

  // 3. Auto Revenue Share Split Lock (Mistri 80%, Agent 5%+Platform 15% OR Platform 20%)
  this.hasAgent = Boolean(this.agent);
  this.mistriSharePercent = 80;
  if (this.hasAgent) {
    this.agentSharePercent = 5;
    this.platformSharePercent = 15;
  } else {
    this.agentSharePercent = 0;
    this.platformSharePercent = 20;
  }

  next();
});

module.exports = mongoose.model('Job', jobSchema);
