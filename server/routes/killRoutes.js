const express = require('express');
const router = express.Router();
const Kill = require('../models/Kill');
const { requireRole } = require('../middleware/authMiddleware');

const PROTECTED_TARGETS = ['SUPER_ADMIN_VERIFY', 'SUPER_ADMIN_GATE', '4_LAYER_BIOMETRIC'];

// @route   GET /api/v1/kill
// @desc    Get All Kill Switch Rules & History
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
router.post('/', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { killType, target, phone, isKilled, active, reason } = req.body;
    const finalTarget = phone ? String(phone).trim() : String(target || '').trim();
    const finalType = phone ? 'USER' : killType || 'FEATURE';
    const finalStatus = typeof active === 'boolean' ? active : Boolean(isKilled);

    if (!finalTarget) {
      return res.status(400).json({ success: false, message: 'Target feature or phone is required.' });
    }

    if (PROTECTED_TARGETS.includes(finalTarget.toUpperCase())) {
      return res.status(403).json({
        success: false,
        message: 'SECURITY LOCK: Super Admin Verify system cannot be killed. Always Active.',
      });
    }

    const adminId = req.user?.id || req.user?.superAdminId || 'SA_2026_MASTER';

    const record = await Kill.findOneAndUpdate(
      { target: finalTarget },
      {
        killType: finalType,
        target: finalTarget,
        status: finalStatus,
        reason: reason || 'Controlled by Super Admin',
        updatedBy: adminId,
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: `Kill switch for [${finalTarget}] set to ${record.status ? 'KILLED (OFF)' : 'ACTIVE (ON)'}.`,
      record,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/kill/bulk
// @desc    Master Global Kill Switch ON or OFF
router.post('/bulk', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { action, active } = req.body;
    const status = typeof active === 'boolean' ? active : action === 'ON';
    const adminId = req.user?.id || req.user?.superAdminId || 'SA_2026_MASTER';

    await Kill.findOneAndUpdate(
      { target: 'GLOBAL_SYSTEM_ALL' },
      {
        killType: 'GLOBAL',
        target: 'GLOBAL_SYSTEM_ALL',
        status,
        reason: 'Master Global Kill Switch',
        updatedBy: adminId,
      },
      { upsert: true, new: true }
    );

    await Kill.updateMany(
      { target: { $nin: [...PROTECTED_TARGETS, 'GLOBAL_SYSTEM_ALL'] } },
      { $set: { status, updatedBy: adminId } }
    );

    res.status(200).json({
      success: true,
      globalKilled: status,
      message: `Master Kill Switch turned ${status ? 'ON (System Locked)' : 'OFF (System Active)'}.`,
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/v1/kill/:id
// @desc    Delete a Kill Switch Entry
router.delete('/:id', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    await Kill.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Kill rule deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
