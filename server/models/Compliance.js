const mongoose = require('mongoose');

const complianceSchema = new mongoose.Schema({
  mistriId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mistri',
    required: true
  },
  documentType: {
    type: String,
    enum: ['nid', 'trade_license', 'safety_certificate', 'police_clearance'],
    required: true
  },
  documentUrl: {
    type: String,
    required: true
  },
  documentNumber: {
    type: String
  },
  expiryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'expired'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Compliance', complianceSchema);