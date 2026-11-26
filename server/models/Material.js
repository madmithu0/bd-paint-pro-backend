const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Material name is required'],
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: 'Standard',
    },
    grade: {
      type: String,
      trim: true,
      default: 'Standard',
    },
    unit: {
      type: String,
      default: 'Liter',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    bulkDiscountPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    merchantCommissionRate: {
      type: Number,
      default: 4,
      min: 0,
      max: 20,
    },
    isDirectPurchaseEnabled: {
      type: Boolean,
      default: true,
    },
    digitalMemoHash: {
      type: String,
      default: null,
    },
    customerOtpApproved: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

materialSchema.pre('save', function (next) {
  if (!this.unitPrice && this.price) this.unitPrice = this.price;
  if (!this.price && this.unitPrice) this.price = this.unitPrice;
  if (!this.merchantId && this.merchant) this.merchantId = this.merchant;
  if (!this.merchant && this.merchantId) this.merchant = this.merchantId;
  if (!this.bulkDiscountPrice && this.unitPrice > 0) this.bulkDiscountPrice = this.unitPrice;
  next();
});

module.exports = mongoose.model('Material', materialSchema);
