const mongoose = require('mongoose');
const argon2 = require('argon2');

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
        values: ['Customer', 'Mistri', 'Agent', 'Merchant'],
        message: 'Invalid role. SuperAdmin cannot be stored in standard User schema.',
      },
      default: 'Customer',
      required: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
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
      default: 'v3.0.0',
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await argon2.hash(this.password, { type: argon2.argon2id });
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return argon2.verify(this.password, candidatePassword);
};

module.exports = mongoose.model('User', userSchema);
