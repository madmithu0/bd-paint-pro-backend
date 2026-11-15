const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Dispute reason is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    evidenceUrls: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['Open', 'UnderReview', 'Solved', 'Closed'],
      default: 'Open',
    },
    solutionNote: {
      type: String,
      default: null,
    },
    solvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    solvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Dispute', disputeSchema);
