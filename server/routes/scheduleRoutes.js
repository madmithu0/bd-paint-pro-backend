const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');

// @route   POST /api/v1/schedules
// @desc    Create a Job Work Schedule
// @access  Protected
router.post('/', async (req, res, next) => {
  try {
    const { jobId, date, timeSlot, note } = req.body;

    if (!jobId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Job ID and scheduled date are required.',
      });
    }

    const schedule = await Schedule.create({
      job: jobId,
      createdBy: req.user.id,
      date: new Date(date),
      timeSlot: timeSlot || '09:00 AM - 05:00 PM',
      note: note || '',
      status: 'Scheduled',
    });

    res.status(201).json({
      success: true,
      schedule,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/schedules
// @desc    Get Schedule List
// @access  Protected
router.get('/', async (req, res, next) => {
  try {
    const { jobId, status } = req.query;
    const filter = {};
    if (jobId) filter.job = jobId;
    if (status) filter.status = status;

    const schedules = await Schedule.find(filter)
      .populate('job', 'sqft totalDays status')
      .sort({ date: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: schedules.length,
      schedules,
    });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/v1/schedules/:id
// @desc    Update Schedule Date or Status
// @access  Protected
router.patch('/:id', async (req, res, next) => {
  try {
    const { date, timeSlot, status } = req.body;
    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (timeSlot) updateData.timeSlot = timeSlot;
    if (status) updateData.status = status;

    const schedule = await Schedule.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }

    res.status(200).json({
      success: true,
      schedule,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
