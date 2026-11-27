const express = require('express');
const router = express.Router();
const Kill = require('../models/Kill');
const AuditLog = require('../models/AuditLog');
const { requireRole } = require('../middleware/authMiddleware');

const PROTECTED_TARGETS = [
  'SUPER_ADMIN_VERIFY',
  'SUPER_ADMIN_GATE',
  'SUPER_ADMIN_PASSWORD_2FA',
];

const ALLOWED_FEATURE_SWITCHES = [
  'SITE_VISIT',
  'MID_JOB_ADDON',
  'DIRECT_STORE',
  'CHAT',
  'AI_MEASURE',
  'BKASH_NAGAD',
  'AGENT_LEAD_LOCK',
];

router.get('/public-status', async (req, res, next) => {
  try {
    const records = await Kill.find().lean();
    const featureSwitches = {};
    let govtFeatureFlags = {
      autoVatEnabled: false,
      nbrBinMandateEnabled: false,
      govtAuditEnabled: false,
    };
    let hotlineConfig = {
      number: process.env.HOTLINE_NUMBER || '',
      isLive: false,
    };

    records.forEach((item) => {
      if (item.target === 'GOVT_COMPLIANCE_FLAGS' && item.govtFeatureFlags) {
        govtFeatureFlags = {
          autoVatEnabled: Boolean(item.govtFeatureFlags.autoVatEnabled),
          nbrBinMandateEnabled: Boolean(item.govtFeatureFlags.nbrBinMandateEnabled),
          govtAuditEnabled: Boolean(item.govtFeatureFlags.govtAuditEnabled),
        };
      } else if (item.target === 'HOTLINE_CONFIG' && item.hotlineConfig) {
        hotlineConfig = {
          number: item.hotlineConfig.number || '',
          isLive: Boolean(item.hotlineConfig.isLive),
        };
      } else if (item.target) {
        featureSwitches[item.target] = Boolean(item.status ?? item.active);
      }
    });

    return res.status(200).json({
      success: true,
      featureSwitches,
      govtFeatureFlags,
      hotlineConfig,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const kills = await Kill.find().sort({ updatedAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      protectedAlwaysActive: PROTECTED_TARGETS,
      supportedFeatures: ALLOWED_FEATURE_SWITCHES,
      kills,
    });
  } catch (error) {
    next(error);
  }
});
router.post('/', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { killType, target, phone, isKilled, active, reason } = req.body;
    const finalTarget = phone ? String(phone).trim() : String(target || '').trim().toUpperCase();
    const finalType = phone ? 'USER' : killType || 'FEATURE';
    const finalStatus = typeof active === 'boolean' ? active : Boolean(isKilled);

    if (!finalTarget) {
      return res.status(400).json({ success: false, message: 'Target feature or phone is required.' });
    }

    if (finalTarget === 'GLOBAL_SYSTEM_ALL') {
      return res.status(400).json({
        success: false,
        message: 'Global Kill All is permanently removed in v3.8.0. Use individual feature switches.',
      });
    }

    if (PROTECTED_TARGETS.includes(finalTarget)) {
      return res.status(403).json({
        success: false,
        message: 'SECURITY LOCK: Super Admin authentication cannot be disabled.',
      });
    }

    const adminId = req.user?.id || req.user?.superAdminId || 'SA_2026_MASTER';

    const record = await Kill.findOneAndUpdate(
      { target: finalTarget },
      {
        killType: finalType,
        target: finalTarget,
        status: finalStatus,
        active: finalStatus,
        reason: reason || 'Controlled by Super Admin',
        updatedBy: adminId,
      },
      { upsert: true, new: true }
    );

    if (req.app.get('io')) {
      req.app.get('io').emit('system:killSwitchUpdated', {
        target: finalTarget,
        isKilled: finalStatus,
      });
    }

    await AuditLog.create({
      user: adminId,
      role: 'SuperAdmin',
      action: `KILL_SWITCH_${finalTarget}_${finalStatus ? 'OFF' : 'ON'}`,
      category: 'ADMIN',
      ipAddress: req.ip || '',
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Feature switch [${finalTarget}] set to ${record.status ? 'DISABLED (OFF)' : 'ENABLED (ON)'}.`,
      record,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/govt-switches', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { autoVatEnabled, nbrBinMandateEnabled, govtAuditEnabled } = req.body;
    const adminId = req.user?.id || req.user?.superAdminId || 'SA_2026_MASTER';

    const existing = await Kill.findOne({ target: 'GOVT_COMPLIANCE_FLAGS' }).lean();
    const currentFlags = existing?.govtFeatureFlags || {
      autoVatEnabled: false,
      nbrBinMandateEnabled: false,
      govtAuditEnabled: false,
    };

    const updatedFlags = {
      autoVatEnabled:
        autoVatEnabled !== undefined ? Boolean(autoVatEnabled) : currentFlags.autoVatEnabled,
      nbrBinMandateEnabled:
        nbrBinMandateEnabled !== undefined
          ? Boolean(nbrBinMandateEnabled)
          : currentFlags.nbrBinMandateEnabled,
      govtAuditEnabled:
        govtAuditEnabled !== undefined ? Boolean(govtAuditEnabled) : currentFlags.govtAuditEnabled,
    };

    const record = await Kill.findOneAndUpdate(
      { target: 'GOVT_COMPLIANCE_FLAGS' },
      {
        $set: {
          killType: 'GOVT',
          target: 'GOVT_COMPLIANCE_FLAGS',
          govtFeatureFlags: updatedFlags,
          updatedBy: adminId,
        },
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      user: adminId,
      role: 'SuperAdmin',
      action: 'GOVT_COMPLIANCE_SWITCHES_UPDATED',
      category: 'ADMIN',
      ipAddress: req.ip || '',
      details: updatedFlags,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Government compliance switches updated successfully.',
      govtFeatureFlags: record.govtFeatureFlags,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/hotline', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { hotlineNumber, isLive } = req.body;
    const adminId = req.user?.id || req.user?.superAdminId || 'SA_2026_MASTER';

    const record = await Kill.findOneAndUpdate(
      { target: 'HOTLINE_CONFIG' },
      {
        $set: {
          killType: 'HOTLINE',
          target: 'HOTLINE_CONFIG',
          status: Boolean(isLive),
          active: Boolean(isLive),
          hotlineConfig: {
            number: String(hotlineNumber || '').trim(),
            isLive: Boolean(isLive),
          },
          updatedBy: adminId,
        },
      },
      { upsert: true, new: true }
    );

    if (req.app.get('io')) {
      req.app.get('io').emit('system:hotlineUpdated', record.hotlineConfig);
    }

    return res.status(200).json({
      success: true,
      message: 'Live hotline configuration updated.',
      hotlineConfig: record.hotlineConfig,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    await Kill.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Kill rule deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
