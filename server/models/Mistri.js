const mongoose = require('mongoose');
const MistriSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  skills: [String],
  rating: { type: Number, default: 5 },
  completedJobs: { type: Number, default: 0 },
  isAvailable: { type: Boolean, default: true },
  location: { lat: Number, lng: Number }
}, { timestamps: true });
module.exports = mongoose.model('Mistri', MistriSchema);