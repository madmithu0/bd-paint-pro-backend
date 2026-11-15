const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const { requireRole } = require('../middleware/authMiddleware');

// @route   POST /api/v1/attendance
// @desc    Create Daily Work Attendance with GPS Coordinates & Cloudinary Photo URL
// @access  Protected (Mistri)
router.post('/', requireRole(['Mistri']), async (req, res, next) => {
  try {
    const { jobId, latitude, longitude, photoUrl, note } = req.body;

    if (!jobId || !latitude || !longitude || !photoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Job ID, GPS location (latitude/longitude), and work photo are required.',
      });
    }

    const attendance = await Attendance.create({
      user: req.user.id,
      job: jobId,
      gps: {
        lat: Number(latitude),
        lng: Number(longitude),
      },
      photo: photoUrl,
      note: note || '',
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: 'Attendance submitted successfully.',
      attendance,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/attendance
// @desc    Get Attendance List (Filtered by Job ID or User)
// @access  Protected
router.get('/', async (req, res, next) => {
  try {
    const { jobId, status } = req.query;
    const filter = {};

    if (jobId) filter.job = jobId;
    if (status) filter.status = status;
    if (req.user.role === 'Mistri') filter.user = req.user.id;

    const records = await Attendance.find(filter)
      .populate('user', 'name phone role')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/v1/attendance/:id/approve
// @desc    Approve or Reject Mistri Attendance
// @access  Protected (Customer / Agent / Merchant / SuperAdmin)
router.patch(
  '/:id/approve',
  requireRole(['Customer', 'Agent', 'Merchant', 'SuperAdmin']),
  async (req, res, next) => {
    try {
      const { status } = req.body; // 'Approved' or 'Rejected'
      if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be Approved or Rejected.',
        });
      }

      const record = await Attendance.findByIdAndUpdate(
        req.params.id,
        { status, approvedBy: req.user.id, approvedAt: new Date() },
        { new: true }
      );

      if (!record) {
        return res.status(404).json({ success: false, message: 'Attendance record not found.' });
      }

      res.status(200).json({
        success: true,
        message: `Attendance ${status.toLowerCase()} successfully.`,
        record,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
