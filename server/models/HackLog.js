const mongoose = require('mongoose');

const hackLogSchema = new mongoose.Schema(
  {
    hackIp: {
      type: String,
      required: true,
      index: true,
    },
    cloudflareRayId: {
      type: String,
      default: 'N/A',
    },
    device: {
      type: String,
      default: 'Unknown',
    },
    attackType: {
      type: String,
      enum: ['XSS', 'NoSQLi', 'Bot', 'BruteForce', 'VirusUpload', 'SuperAdminProbe', 'InvalidSignature'],
      required: true,
    },
    endpoint: {
      type: String,
      default: '',
    },
    payloadSnippet: {
      type: String,
      default: '',
    },
    action: {
      type: String,
      default: 'AUTO_BLOCKED',
    },
    autoBlocked: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('HackLog', hackLogSchema);
