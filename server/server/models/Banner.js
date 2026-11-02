const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  linkType: {
    type: String,
    enum: ['service', 'promo', 'external', 'none'],
    default: 'none'
  },
  linkValue: {
    type: String
  },
  position: {
    type: String,
    enum: ['home_top', 'home_middle', 'service_page', 'offer_page'],
    default: 'home_top'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Banner', bannerSchema);