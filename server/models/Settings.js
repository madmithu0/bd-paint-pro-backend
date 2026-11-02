const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  businessName: { type: String, default: 'Mistri Service' },
  currency: { type: String, default: 'BDT' },
  contactPhone: String,
  address: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Settings', SettingsSchema);
