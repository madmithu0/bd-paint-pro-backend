const express = require('express');
const router = express.Router();
const Dispute = require('../models/Dispute');
const { requireRole } = require('../middleware/authMiddleware');

// @route   POST /api/v1/disputes
// @desc    Create a Job/Payment Dispute
// @access  Protected
router.post('/', async (req, res, next) => {
  try {
    const { jobId, reason, description, evidenceUrls = [] } = req.body;

    if (!jobId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Job ID and dispute reason are required.',
      });
    }

    const dispute = await Dispute.create({
      job: jobId,
      raisedBy: req.user.id,
      reason,
      description: description || '',
      evidenceUrls,
      status: 'Open',
    });

    res.status(201).json({
      success: true,
      message: 'Dispute filed successfully. Support team will review it shortly.',
      dispute,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/disputes
// @desc    Get Dispute List
// @access  Protected
router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.role === 'SuperAdmin' ? {} : { raisedBy: req.user.id };

    const disputes = await Dispute.find(filter)
      .populate('job', 'sqft price status')
      .populate('raisedBy', 'name phone role')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: disputes.length,
      disputes,
    });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/v1/disputes/:id/solve
// @desc    Resolve / Solve a Dispute
// @access  Protected (SuperAdmin / Agent)
router.patch('/:id/solve', requireRole(['SuperAdmin', 'Agent']), async (req, res, next) => {
  try {
    const { solutionNote, status = 'Solved' } = req.body;

    const dispute = await Dispute.findByIdAndUpdate(
      req.params.id,
      {
        status,
        solutionNote: solutionNote || 'Resolved by authority',
        solvedBy: req.user.id,
        solvedAt: new Date(),
      },
      { new: true }
    );

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Dispute marked as solved.',
      dispute,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
