const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const walletAccountSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['bKash', 'Nagad', 'Rocket', 'Bank'],
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: {
        values: ['Customer', 'Mistri', 'Agent', 'Merchant', 'Admin', 'SuperAdmin'],
        message: 'Invalid user role specified.',
      },
      default: 'Customer',
      required: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    passwordHistory: {
      type: [String],
      default: [],
      select: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    walletAccounts: {
      type: [walletAccountSchema],
      default: [],
    },
    termsAcceptedVersion: {
      type: String,
      default: null,
    },
    merchantCommissionAgreed: {
      type: Boolean,
      default: false,
    },
    accountStatus: {
      type: String,
      enum: ['Pending', 'Active', 'Suspended', 'Banned'],
      default: 'Active',
    },
    verify: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    suspended: {
      type: Boolean,
      default: false,
    },
    blockReason: {
      type: String,
      default: null,
    },
    nidNumber: {
      type: String,
      default: null,
    },
    nidPhotoUrl: {
      type: String,
      default: null,
    },
    skills: {
      type: [String],
      default: [],
    },
    capableServices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
      },
    ],
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    qualityScore: {
      type: Number,
      default: 5.0,
      min: 1.0,
      max: 5.0,
    },
    penaltyStatus: {
      type: String,
      enum: ['Active', 'Warning', 'Suspended'],
      default: 'Active',
    },
    district: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    upazila: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    referredByAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    avatarPublicId: {
      type: String,
      default: '',
    },
    schemaVersionLock: {
      type: String,
      default: 'v3.8.0',
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema
  .virtual('password')
  .get(function () {
    return this.passwordHash;
  })
  .set(function (value) {
    this.passwordHash = value;
  });

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
    const hashed = await bcrypt.hash(this.passwordHash, saltRounds);
    this.passwordHash = hashed;
    this.passwordChangedAt = new Date(Date.now() - 1000);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

module.exports = mongoose.model('User', userSchema);
