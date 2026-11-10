const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema({
  division: {
    type: String,
    required: true,
    trim: true
  },
  district: {
    type: String,
    required: true,
    trim: true
  },
  thana: {
    type: String,
    required: true,
    trim: true
  },
  union: {
    type: String,
    default: '',
    trim: true
  },
  village: {
    type: String,
    default: '',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Area', areaSchema);