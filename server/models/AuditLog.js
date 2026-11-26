const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      default: 'ANONYMOUS',
      index: true,
    },
    role: {
      type: String,
      default: 'Guest',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'AUTH',
        'PASSWORD_RESET',
        'VERSION_CHANGE',
        'RATE_UPDATE',
        'KILL_SWITCH',
        'ROLE_TERMS_EDIT',
        'WALLET_VERIFY',
        'PAYOUT',
        'LEGAL_NOTICE',
        'HIDE_TOGGLE',
        'PAYMENT',
        'ADMIN',
        'GENERAL',
      ],
      default: 'GENERAL',
    },
    ipAddress: {
      type: String,
      default: '0.0.0.0',
    },
    deviceInfo: {
      type: String,
      default: 'Unknown Device',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isImmutableLock: {
      type: Boolean,
      default: false,
      index: true,
    },
    time: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
  function (next) {
    const query = this.getQuery() || {};
    if (query.isImmutableLock === true) {
      return next(new Error('SECURITY VIOLATION: Immutable audit log record cannot be modified or deleted.'));
    }
    next();
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
