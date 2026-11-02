const mongoose = require('mongoose');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['superAdmin','agent','mistri','customer'], required: true },
  phone: { type: String, required: true },
  phoneVerified: { type: Boolean, default: false },
  email: String,
  emailVerified: { type: Boolean, default: false },
  faceData: { type: String, select: false },
  voiceData: { type: String, select: false },
  password: { type: String, required: true, minlength: 12 },
  loginAttempt: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  isBTRCVerified: { type: Boolean, default: false }
}, { timestamps: true });

UserSchema.methods.encryptData = function(data) {
  const key = Buffer.from(process.env.AES_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let enc = cipher.update(data, 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
};

module.exports = mongoose.model('User', UserSchema);