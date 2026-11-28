const express = require('express');
const router = express.Router();
const Kill = require('../models/Kill');
const AuditLog = require('../models/AuditLog');
const { requireRole } = require('../middleware/authMiddleware');

const PROTECTED_TARGETS = [
  'SUPER_ADMIN_VERIFY',
  'SUPER_ADMIN_GATE',
  'SUPER_ADMIN_PASSWORD_2FA',
  'GLOBAL_KILL_ALL',
  'GLOBAL_SYSTEM_ALL',
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

// 1. Public Status Endpoint (Includes Mistri Signup Switch & Upazila Quota)
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
    let mistriSignupControl = {
      newMistriSignupEnabled: true,
      maxMistriPerUpazila: 0, // 0 = Unlimited
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
      } else if (item.target === 'MISTRI_SIGNUP_CONTROL') {
        mistriSignupControl = {
          newMistriSignupEnabled:
            item.newMistriSignupEnabled !== undefined ? Boolean(item.newMistriSignupEnabled) : true,
          maxMistriPerUpazila: Number(item.maxMistriPerUpazila) || 0,
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
      mistriSignupControl,
    });
  } catch (error) {
    next(error);
  }
});

// 2. Get All Kill Rules (Super Admin Only)
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

// 3. Toggle Individual Feature Switch or Suspend Specific Phone
router.post('/', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { killType, target, phone, isKilled, active, reason } = req.body;
    const finalTarget = phone ? String(phone).trim() : String(target || '').trim().toUpperCase();
    const finalType = phone ? 'USER' : killType || 'FEATURE';
    const finalStatus = typeof active === 'boolean' ? active : Boolean(isKilled);

    if (!finalTarget) {
      return res.status(400).json({ success: false, message: 'Target feature or phone is required.' });
    }

    if (finalTarget === 'GLOBAL_SYSTEM_ALL' || finalTarget === 'GLOBAL_KILL_ALL') {
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
    const actionLabel = `KILL_SWITCH_${finalTarget}_${finalStatus ? 'OFF' : 'ON'}`;

    const record = await Kill.findOneAndUpdate(
      { target: finalTarget },
      {
        $set: {
          killType: finalType,
          target: finalTarget,
          status: finalStatus,
          active: finalStatus,
          reason: reason || 'Controlled by Super Admin',
          updatedBy: adminId,
        },
        $push: {
          auditHistory: {
            action: actionLabel,
            changedBy: adminId,
            reason: reason || 'Controlled by Super Admin',
            changedAt: new Date(),
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
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
      action: actionLabel,
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

// 4. NEW (v3.8.1): Toggle New Mistri Signup ON/OFF & Upazila Quota Control
router.patch('/mistri-signup', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { newMistriSignupEnabled, maxMistriPerUpazila, reason } = req.body;

    if (typeof newMistriSignupEnabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'newMistriSignupEnabled must be a boolean (true or false).',
      });
    }

    const parsedQuota = Number(maxMistriPerUpazila ?? 0);
    if (isNaN(parsedQuota) || parsedQuota < 0 || !Number.isInteger(parsedQuota)) {
      return res.status(400).json({
        success: false,
        message: 'maxMistriPerUpazila must be a non-negative integer (0 for unlimited).',
      });
    }

    const adminId = req.user?.id || req.user?.superAdminId || 'SA_2026_MASTER';
    const actionLabel = `MISTRI_SIGNUP_${newMistriSignupEnabled ? 'ON' : 'OFF'}_QUOTA_${parsedQuota}`;

    const record = await Kill.findOneAndUpdate(
      { target: 'MISTRI_SIGNUP_CONTROL' },
      {
        $set: {
          killType: 'MISTRI_SIGNUP',
          target: 'MISTRI_SIGNUP_CONTROL',
          status: !newMistriSignupEnabled, // consistent with kill status (true = killed/paused)
          newMistriSignupEnabled,
          maxMistriPerUpazila: parsedQuota,
          reason: String(reason || 'Mistri registration & quota updated by Super Admin').trim(),
          updatedBy: adminId,
        },
        $push: {
          auditHistory: {
            action: actionLabel,
            changedBy: adminId,
            reason: String(reason || '').trim(),
            changedAt: new Date(),
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    if (req.app.get('io')) {
      req.app.get('io').emit('system:mistriSignupUpdated', {
        newMistriSignupEnabled: record.newMistriSignupEnabled,
        maxMistriPerUpazila: record.maxMistriPerUpazila,
      });
    }

    await AuditLog.create({
      user: adminId,
      role: 'SuperAdmin',
      action: actionLabel,
      category: 'ADMIN',
      ipAddress: req.ip || '',
      details: {
        newMistriSignupEnabled: record.newMistriSignupEnabled,
        maxMistriPerUpazila: record.maxMistriPerUpazila,
      },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `New Mistri Signup is now ${record.newMistriSignupEnabled ? 'ENABLED (ON)' : 'PAUSED (OFF)'} (Upazila Quota: ${record.maxMistriPerUpazila === 0 ? 'Unlimited' : record.maxMistriPerUpazila}).`,
      mistriSignupControl: {
        newMistriSignupEnabled: record.newMistriSignupEnabled,
        maxMistriPerUpazila: record.maxMistriPerUpazila,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 5. Govt Compliance Switches
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
        $push: {
          auditHistory: {
            action: 'GOVT_COMPLIANCE_SWITCHES_UPDATED',
            changedBy: adminId,
            changedAt: new Date(),
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
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

// 6. Live Hotline Config
