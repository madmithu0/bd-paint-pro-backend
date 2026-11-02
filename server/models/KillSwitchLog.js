const mongoose = require('mongoose');

const killSwitchLogSchema = new mongoose.Schema({
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  affectedMistriId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mistri'
  },
  affectedJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  action: {
    type: String,
    enum: ['global_pause', 'mistri_block', 'job_stop', 'payment_hold'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('KillSwitchLog', killSwitchLogSchema);