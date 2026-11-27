const mongoose = require('mongoose');

const serviceCategorySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    nameBn: {
      type: String,
      default: '',
      trim: true,
    },
    nameEn: {
      type: String,
      default: '',
      trim: true,
    },
    applicationArea: {
      type: String,
      required: true,
      trim: true,
    },
    specialtyArea: {
      type: String,
      default: '',
      trim: true,
    },
    slotSqftPerDay: {
      type: Number,
      required: true,
      min: 50,
    },
    defaultCoats: {
      type: Number,
      default: 2,
      min: 1,
      max: 5,
    },
    perCoatRateMultiplier: {
      type: Number,
      default: 0.4,
      min: 0,
      max: 2,
    },
    labourRatePerSqft: {
      type: Number,
      required: true,
      min: 1,
    },
    withMaterialRatePerSqft: {
      type: Number,
      required: true,
      min: 1,
    },
    availableBrands: {
      type: [String],
      default: ['Berger', 'Asian Paints', 'Rainbow'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isLabourOnlyEnabled: {
      type: Boolean,
      default: true,
    },
    isWithMaterialEnabled: {
      type: Boolean,
      default: true,
    },
    disabledReason: {
      type: String,
      default: '',
      trim: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
serviceCategorySchema.index({ isActive: 1, displayOrder: 1 });

serviceCategorySchema.pre('validate', function (next) {
  if (!this.nameEn && this.name) {
    this.nameEn = this.name;
  }
  if (!this.name && this.nameEn) {
    this.name = this.nameEn;
  }
  if (!this.specialtyArea && this.applicationArea) {
    this.specialtyArea = this.applicationArea;
  }
  if (!this.applicationArea && this.specialtyArea) {
    this.applicationArea = this.specialtyArea;
  }
  if (this.withMaterialRatePerSqft < this.labourRatePerSqft) {
    return next(
      new Error('With-material rate cannot be lower than labour-only rate')
    );
  }
  next();
});

serviceCategorySchema.methods.calculateEstimate = function (
  sqft,
  isMistriOnly,
  coatCount
) {
  const validSqft = Math.max(0, Number(sqft) || 0);
  const coats = Math.max(1, Number(coatCount || this.defaultCoats || 2));
  const coatMultiplier =
    coats > 1 ? 1 + (coats - 1) * (this.perCoatRateMultiplier || 0.4) : 1;

  const calculatedSlots = Number(
    ((validSqft * coatMultiplier) / this.slotSqftPerDay).toFixed(2)
  );
  const baseRate = isMistriOnly
    ? this.labourRatePerSqft
    : this.withMaterialRatePerSqft;
  const appliedRate = Number((baseRate * coatMultiplier).toFixed(2));
  const subTotal = Math.round(validSqft * appliedRate);

  const estimatedMaterialCost = isMistriOnly
    ? 0
    : Math.round(
        validSqft *
          (this.withMaterialRatePerSqft - this.labourRatePerSqft) *
          coatMultiplier
      );
  const estimatedNetProfit = subTotal - estimatedMaterialCost;

  return {
    serviceId: this._id,
    code: this.code,
    name: this.name,
    nameBn: this.nameBn,
    nameEn: this.nameEn,
    sqft: validSqft,
    coatCount: coats,
    coatMultiplier: Number(coatMultiplier.toFixed(2)),
    isMistriOnly: Boolean(isMistriOnly),
    slotSqftPerDay: this.slotSqftPerDay,
    calculatedSlots,
    appliedRate,
    subTotal,
    estimatedMaterialCost,
    estimatedNetProfit,
  };
};

module.exports =
  mongoose.models.ServiceCategory ||
  mongoose.model('ServiceCategory', serviceCategorySchema);
