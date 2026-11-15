const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      default: '09:00 AM - 05:00 PM',
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Scheduled', 'In-Progress', 'Completed', 'Rescheduled', 'Cancelled'],
      default: 'Scheduled',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Schedule', scheduleSchema);
