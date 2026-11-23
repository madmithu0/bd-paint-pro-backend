const mongoose = require('mongoose');

const selectedServiceItemSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceCategory',
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    sqft: {
      type: Number,
      required: true,
      min: 1,
    },
    isMistriOnly: {
      type: Boolean,
      default: false,
    },
    slotSqftPerDay: {
      type: Number,
      required: true,
      default: 450,
    },
    calculatedSlots: {
      type: Number,
      default: 0,
    },
    appliedRate: {
      type: Number,
      required: true,
    },
    subTotal: {
      type: Number,
      required: true,
    },
    estimatedMaterialCost: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

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
    selectedServices: {
      type: [selectedServiceItemSchema],
      default: [],
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
    netProfit: {
      type: Number,
      default: 0,
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
    materialMemoApproved: {
      type: Boolean,
      default: false,
    },
    labourCost: {
      type: Number,
      default: 0,
    },
    isMistriOnly: {
      type: Boolean,
      default: false,
    },
    perDayCapacity: {
      type: Number,
      default: 450,
    },
    totalSlots: {
      type: Number,
      default: 0,
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
    isSiteVisitRequested: {
      type: Boolean,
      default: false,
    },
    siteVisitStatus: {
      type: String,
      enum: ['None', 'Requested', 'Scheduled', 'Completed'],
      default: 'None',
    },
    milestoneStages: {
      stage1Percent: { type: Number, default: 30 },
      stage1Amount: { type: Number, default: 0 },
      stage1Paid: { type: Boolean, default: false },
      stage1PaidAt: { type: Date, default: null },
      stage2Percent: { type: Number, default: 40 },
      stage2Amount: { type: Number, default: 0 },
      stage2Paid: { type: Boolean, default: false },
      stage3Percent: { type: Number, default: 30 },
      stage3Amount: { type: Number, default: 0 },
      stage3Paid: { type: Boolean, default: false },
    },
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
