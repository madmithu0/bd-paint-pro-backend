const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { requireRole } = require('../middleware/authMiddleware');

// Helper: Instant 450 Sqft Per Day Calculator Endpoint (100 Sqft = 0.22 Day)
router.post('/calculate-days', (req, res) => {
  const { sqft, mistriCount = 1 } = req.body;
  const numericSqft = Number(sqft);

  if (!numericSqft || numericSqft <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid square feet (Sqft) is required.',
    });
  }

  const baseDays = Number((numericSqft / 450).toFixed(2));
  const effectiveMistri = Math.max(1, Number(mistriCount));
  const adjustedDays = Number((baseDays / effectiveMistri).toFixed(2));

  res.status(200).json({
    success: true,
    sqft: numericSqft,
    perDayCapacity: 450,
    baseDays,
    mistriCount: effectiveMistri,
    adjustedDays,
    formula: 'Total Days = Sqft / 450',
  });
});

// @route   POST /api/v1/jobs
// @desc    Create a new painting/wall repair job (Supports Mistri-Only & AI Wall Check)
// @access  Protected (Customer / Agent / Merchant)
router.post('/', requireRole(['Customer', 'Agent', 'Merchant']), jobController.createJob);

// @route   GET /api/v1/jobs
// @desc    Get Job List with status, role, and location filters
// @access  Protected
router.get('/', jobController.getJobList);

// @route   GET /api/v1/jobs/:id
// @desc    Get Single Job Details including Price & Share Breakup
// @access  Protected
router.get('/:id', jobController.getJobDetails);

// @route   PATCH /api/v1/jobs/:id/assign
// @desc    Assign Mistri or Team to a Job
// @access  Protected (Agent / Merchant / SuperAdmin)
router.patch('/:id/assign', requireRole(['Agent', 'Merchant', 'SuperAdmin']), jobController.assignJob);

// @route   PATCH /api/v1/jobs/:id/status
// @desc    Update Job Status (Pending, In-Progress, Completed, Cancelled)
// @access  Protected
router.patch('/:id/status', jobController.updateJobStatus);

module.exports = router;
