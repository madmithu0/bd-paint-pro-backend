const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  mistriId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mistri',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String
  },
  categories: {
    punctuality: {
      type: Number,
      min: 1,
      max: 5
    },
    quality: {
      type: Number,
      min: 1,
      max: 5
    },
    behavior: {
      type: Number,
      min: 1,
      max: 5
    },
    cleanliness: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  response: {
    text: String,
    respondedAt: Date
  }
}, {
  timestamps: true
});

reviewSchema.index({ jobId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);