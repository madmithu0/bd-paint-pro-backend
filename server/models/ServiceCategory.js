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
    applicationArea: {
      type: String,
      required: true,
      trim: true,
    },
    slotSqftPerDay: {
      type: Number,
      required: true,
      min: 50,
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
  if (this.withMaterialRatePerSqft < this.labourRatePerSqft) {
    return next(
      new Error('With-material rate cannot be lower than labour-only rate')
    );
  }
  next();
});

serviceCategorySchema.methods.calculateEstimate = function (sqft, isMistriOnly) {
  const validSqft = Math.max(0, Number(sqft) || 0);
  const calculatedSlots = Number((validSqft / this.slotSqftPerDay).toFixed(2));
  const appliedRate = isMistriOnly
    ? this.labourRatePerSqft
    : this.withMaterialRatePerSqft;
  const subTotal = Math.round(validSqft * appliedRate);
  const estimatedMaterialCost = isMistriOnly
    ? 0
    : Math.round(
        validSqft * (this.withMaterialRatePerSqft - this.labourRatePerSqft)
      );
  const estimatedNetProfit = subTotal - estimatedMaterialCost;

  return {
    serviceId: this._id,
    code: this.code,
    name: this.name,
    sqft: validSqft,
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
