const express = require('express');
const router = express.Router();
const Kill = require('../models/Kill');
const { requireRole } = require('../middleware/authMiddleware');

const PROTECTED_TARGETS = ['SUPER_ADMIN_VERIFY', 'SUPER_ADMIN_GATE', '4_LAYER_BIOMETRIC'];

// @route   GET /api/v1/kill
// @desc    Get All Kill Switch Rules & History
// @access  Protected (SuperAdmin)
router.get('/', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const kills = await Kill.find().sort({ updatedAt: -1 }).lean();
    res.status(200).json({
      success: true,
      protectedAlwaysActive: PROTECTED_TARGETS,
      kills,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/kill
// @desc    Create or Toggle a Feature/User Kill Switch
// @access  Protected (SuperAdmin)
router.post('/', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { killType, target, isKilled, reason } = req.body;

    if (PROTECTED_TARGETS.includes(String(target).toUpperCase())) {
      return res.status(403).json({
        success: false,
        message: 'SECURITY LOCK: Super Admin Verify system cannot be killed. Always Active.',
      });
    }

    const record = await Kill.findOneAndUpdate(
      { killType, target },
      {
        killType,
        target,
        status: Boolean(isKilled),
        reason: reason || 'Controlled by Super Admin',
        updatedBy: req.user.id,
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: `Kill switch for [${target}] set to ${record.status ? 'ON (Blocked)' : 'OFF (Active)'}.`,
      record,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/kill/bulk
// @desc    Bulk Kill ON or OFF (Excludes Protected Super Admin Verify)
// @access  Protected (SuperAdmin)
router.post('/bulk', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { action } = req.body; // 'ON' or 'OFF'
    const status = action === 'ON';

    await Kill.updateMany(
      { target: { $nin: PROTECTED_TARGETS } },
      { $set: { status, updatedBy: req.user.id } }
    );

    res.status(200).json({
      success: true,
      message: `Bulk Kill Switch turned ${action} (Super Admin Verify remains Always Active).`,
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/v1/kill/:id
// @desc    Delete a Kill Switch Entry
// @access  Protected (SuperAdmin)
router.delete('/:id', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    await Kill.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Kill rule deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
