const mongoose = require('mongoose');
const JobSchema = new mongoose.Schema({
  jobId: { type: String, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mistriId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending','assigned','in_progress','completed','disputed'], default: 'pending' },
  address: { lat: Number, lng: Number, text: String },
  paintArea: Number,
  coats: { type: Number, default: 2 },
  estimate: { material: Number, labor: Number, total: Number },
  unlimitedBill: { isActive: Boolean, dailyRate: Number },
  auditLog: [{ action: String, by: String, at: Date }],
  qualityCheck: { passed: Boolean, checkedBy: String }
}, { timestamps: true });
module.exports = mongoose.model('Job', JobSchema);