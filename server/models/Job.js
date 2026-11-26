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
    serviceName: {
      type: String,
      default: '',
    },
    sqft: {
      type: Number,
      required: true,
      min: 1,
    },
    coatCount: {
      type: Number,
      default: 2,
      min: 1,
    },
    isMistriOnly: {
      type: Boolean,
      default: false,
    },
    paintBrand: {
      type: String,
      default: '',
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
    addedMidJob: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const inputMediaSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['photo', 'video', 'voice'],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    transcribedText: {
      type: String,
      default: '',
    },
    detectedDialect: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const customerSelectedMistriSchema = new mongoose.Schema(
  {
    mistriId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mistriName: {
      type: String,
      default: '',
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
    customerSelectedMistris: {
      type: [customerSelectedMistriSchema],
      default: [],
    },
    assignedTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    selectedServices: {
      type: [selectedServiceItemSchema],
      default: [],
    },
    inputMedia: {
      type: [inputMediaSchema],
      default: [],
    },
    customJobDescription: {
      type: String,
      trim: true,
      default: '',
    },
    sqft: {
      type: Number,
      required: [true, 'Square feet (Sqft) is required'],
      min: [1, 'Sqft must be greater than 0'],
    },
    totalSqft: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'Total job price is required'],
      min: 0,
    },
    totalBill: {
      type: Number,
      default: 0,
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
    milestone1Paid: {
      type: Boolean,
      default: false,
      index: true,
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

jobSchema.pre('save', function (next) {
  if (Array.isArray(this.selectedServices) && this.selectedServices.length > 0) {
    let sumSqft = 0;
    let sumSlots = 0;
    let sumPrice = 0;
    let sumMaterial = 0;
    let allMistriOnly = true;

    this.selectedServices.forEach((item) => {
      if (!item.serviceName && item.name) item.serviceName = item.name;
      if (!item.name && item.serviceName) item.name = item.serviceName;
      const coatFactor = Math.max(1, item.coatCount || 2) / 2;
      const itemSlots = Number(((item.sqft * coatFactor) / Math.max(50, item.slotSqftPerDay)).toFixed(2));
      item.calculatedSlots = itemSlots;
      sumSqft += item.sqft;
      sumSlots += itemSlots;
      sumPrice += item.subTotal;
      sumMaterial += item.isMistriOnly ? 0 : item.estimatedMaterialCost;
      if (!item.isMistriOnly) allMistriOnly = false;
    });

    this.sqft = sumSqft;
    this.price = sumPrice;
    this.isMistriOnly = allMistriOnly;
    this.materialCost = allMistriOnly ? 0 : sumMaterial;
    this.totalSlots = Number(sumSlots.toFixed(2));
  } else {
    if (this.isMistriOnly || this.materialSource === 'CustomerOwn') {
      this.isMistriOnly = true;
      this.materialCost = 0;
    }
    this.totalSlots = Number((this.sqft / Math.max(50, this.perDayCapacity)).toFixed(2));
  }

  this.totalSqft = this.sqft;
  this.totalBill = this.price;
  this.totalDays = Number((this.totalSlots / Math.max(1, this.mistriCount)).toFixed(2));
  this.netProfit = Math.max(0, this.price - this.materialCost);

  if (this.milestone1Paid && !this.milestoneStages.stage1Paid) {
    this.milestoneStages.stage1Paid = true;
  } else if (this.milestoneStages.stage1Paid && !this.milestone1Paid) {
    this.milestone1Paid = true;
  }

  this.milestoneStages.stage1Amount = Math.round(this.price * 0.30);
  this.milestoneStages.stage2Amount = Math.round(this.price * 0.40);
  this.milestoneStages.stage3Amount = Math.max(
    0,
    this.price - this.milestoneStages.stage1Amount - this.milestoneStages.stage2Amount
  );

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
