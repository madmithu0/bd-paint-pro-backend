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
    // Strict Role Lock: SuperAdmin is strictly excluded from database User collection
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
    // Mistri & Merchant specific verification fields
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
    profilePhoto: {
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

// Hash password using Argon2 before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await argon2.hash(this.password, { type: argon2.argon2id });
    next();
  } catch (err) {
    next(err);
  }
});

// Verify password helper method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return argon2.verify(this.password, candidatePassword);
};

module.exports = mongoose.model('User', userSchema);
