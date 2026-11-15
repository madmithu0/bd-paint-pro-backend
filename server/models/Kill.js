const mongoose = require('mongoose');

const PROTECTED_TARGETS = ['SUPER_ADMIN_VERIFY', 'SUPER_ADMIN_GATE', '4_LAYER_BIOMETRIC'];

const killSchema = new mongoose.Schema(
  {
    killType: {
      type: String,
      enum: ['GLOBAL', 'FEATURE', 'USER', 'VERSION'],
      required: true,
    },
    target: {
      type: String,
      required: true,
      trim: true,
      index: true,
      validate: {
        validator: function (val) {
          return !PROTECTED_TARGETS.includes(String(val).toUpperCase());
        },
        message: 'SECURITY LOCK: Super Admin Verify cannot be added as a Kill target.',
      },
    },
    status: {
      type: Boolean,
      default: false, // true = Killed/Blocked, false = Active
    },
    reason: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: String,
      default: 'SUPER_ADMIN',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Kill', killSchema);
