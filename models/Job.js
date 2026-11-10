const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  sqft: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  materialCost: {
    type: Number,
    default: 0
  },
  labourCost: {
    type: Number,
    default: 0
  },
  materialSource: {
    type: String,
    enum: ['company', 'customer'],
    default: 'company'
  },
  isMistriOnly: {
    type: Boolean,
    default: false
  },
  totalDays: {
    type: Number,
    default: 0
  },
  mistriCount: {
    type: Number,
    default: 1
  },
  perDaySqft: {
    type: Number,
    default: 450
  },
  wallProblem: {
    type: String,
    enum: ['none', 'nona', 'damp', 'fatol'],
    default: 'none'
  },
  wallDamageLevel: {
    type: String,
    enum: ['halka', 'majhari', 'beshi'],
    default: 'halka'
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'running', 'completed', 'cancelled'],
    default: 'pending'
  },
  photos: {
    type: [String],
    default: []
  }
}, { timestamps: true });

// Auto Calculate: Total Days = Sqft / 450
jobSchema.pre('save', function(next) {
  if (this.sqft) {
    this.totalDays = Math.ceil(this.sqft / 450 * 100) / 100;
    // 100 Sqft = 0.22 Day
  }
  if (this.isMistriOnly) {
    this.materialCost = 0;
  }
  next();
});

module.exports = mongoose.model('Job', jobSchema);