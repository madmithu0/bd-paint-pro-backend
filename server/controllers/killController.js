const Kill = require('../models/Kill');
const AuditLog = require('../models/AuditLog');
const { broadcastKillSwitchUpdate } = require('../infra/socketEngine');

const PROTECTED_TARGETS = [
  'SUPER_ADMIN_VERIFY',
  'SUPER_ADMIN_GATE',
  'SUPER_ADMIN_LOGIN',
  'GLOBAL_KILL_ALL',
];

const getAllKillSwitches = async (req, res, next) => {
  try {
    const switches = await Kill.find({}).sort({ updatedAt: -1 }).lean();
    let govtConfig = switches.find((s) => s.killType === 'GOVT');

    if (!govtConfig) {
      govtConfig = await Kill.create({
        killType: 'GOVT',
        target: 'GOVT_COMPLIANCE_MASTER',
        status: false,
        govtFeatureFlags: {
          autoVatEnabled: false,
          nbrBinMandateEnabled: false,
          govtAuditEnabled: false,
        },
        hotlineConfig: {
          number: process.env.HOTLINE_NUMBER || '096XXXXXXXX',
          isLive: process.env.HOTLINE_ACTIVE !== 'false',
        },
        reason: 'Default initial startup state (All Govt switches OFF)',
      });
    }

    return res.status(200).json({
      success: true,
      govtFeatureFlags: govtConfig.govtFeatureFlags,
      hotlineConfig: govtConfig.hotlineConfig,
      switches,
    });
  } catch (error) {
    next(error);
  }
};

const toggleFeatureOrUserKill = async (req, res, next) => {
  try {
    const { killType = 'FEATURE', target, status, reason = '' } = req.body;
    const cleanTarget = String(target || '').trim().toUpperCase();

    if (!['FEATURE', 'USER', 'VERSION'].includes(killType) || !cleanTarget) {
      return res.status(400).json({
        success: false,
        message: 'Valid killType (FEATURE, USER, VERSION) and target are required. Global Kill is disabled.',
      });
    }

    if (PROTECTED_TARGETS.includes(cleanTarget)) {
      return res.status(403).json({
        success: false,
        message: 'SECURITY LOCK: Protected Super Admin or Global target cannot be modified.',
      });
    }

    const updated = await Kill.findOneAndUpdate(
      { killType, target: cleanTarget },
      {
        $set: {
          status: Boolean(status),
          reason: String(reason).trim(),
          updatedBy: req.user?.id || 'SUPER_ADMIN',
        },
        $push: {
          auditHistory: {
            action: `${killType}_KILL_${status ? 'ON' : 'OFF'}`,
            changedBy: req.user?.id || 'SUPER_ADMIN',
            reason: String(reason).trim(),
            changedAt: new Date(),
          },
        },
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      user: String(req.user?.id || 'SUPER_ADMIN'),
      role: 'SuperAdmin',
      action: `TOGGLED_${killType}_SWITCH_${cleanTarget}_${status ? 'BLOCKED' : 'ACTIVE'}`,
      category: 'KILL_SWITCH',
      ipAddress: req.clientIp || req.ip,
      details: { killType, target: cleanTarget, status: Boolean(status), reason },
    }).catch(() => {});

    broadcastKillSwitchUpdate({ killType, target: cleanTarget, status: Boolean(status) });

    return res.status(200).json({
      success: true,
      message: `${killType} switch [${cleanTarget}] set to ${status ? 'BLOCKED' : 'ACTIVE'}.`,
      killSwitch: updated,
    });
  } catch (error) {
    next(error);
  }
};
const updateGovtComplianceSwitches = async (req, res, next) => {
  try {
    const { autoVatEnabled, nbrBinMandateEnabled, govtAuditEnabled, reason = '' } = req.body;

    let govtDoc = await Kill.findOne({ killType: 'GOVT' });
    if (!govtDoc) {
      govtDoc = new Kill({
        killType: 'GOVT',
        target: 'GOVT_COMPLIANCE_MASTER',
        status: false,
      });
    }

    if (typeof autoVatEnabled === 'boolean') govtDoc.govtFeatureFlags.autoVatEnabled = autoVatEnabled;
    if (typeof nbrBinMandateEnabled === 'boolean') govtDoc.govtFeatureFlags.nbrBinMandateEnabled = nbrBinMandateEnabled;
    if (typeof govtAuditEnabled === 'boolean') govtDoc.govtFeatureFlags.govtAuditEnabled = govtAuditEnabled;

    govtDoc.reason = String(reason).trim();
    govtDoc.updatedBy = req.user?.id || 'SUPER_ADMIN';
    govtDoc.auditHistory.push({
      action: 'UPDATED_GOVT_COMPLIANCE_FLAGS',
      changedBy: req.user?.id || 'SUPER_ADMIN',
      reason: String(reason).trim(),
      changedAt: new Date(),
    });

    await govtDoc.save();

    await AuditLog.create({
      user: String(req.user?.id || 'SUPER_ADMIN'),
      role: 'SuperAdmin',
      action: 'UPDATED_GOVT_COMPLIANCE_SWITCHES',
      category: 'KILL_SWITCH',
      ipAddress: req.clientIp || req.ip,
      details: { flags: govtDoc.govtFeatureFlags, reason },
    }).catch(() => {});

    broadcastKillSwitchUpdate({ killType: 'GOVT', govtFeatureFlags: govtDoc.govtFeatureFlags });

    return res.status(200).json({
      success: true,
      message: 'Government compliance switches updated successfully.',
      govtFeatureFlags: govtDoc.govtFeatureFlags,
    });
  } catch (error) {
    next(error);
  }
};

const updateLiveHotlineConfig = async (req, res, next) => {
  try {
    const { number, isLive } = req.body;

    let govtDoc = await Kill.findOne({ killType: 'GOVT' });
    if (!govtDoc) {
      govtDoc = new Kill({
        killType: 'GOVT',
        target: 'GOVT_COMPLIANCE_MASTER',
        status: false,
      });
    }

    if (number !== undefined && String(number).trim()) {
      govtDoc.hotlineConfig.number = String(number).trim();
    }
    if (typeof isLive === 'boolean') {
      govtDoc.hotlineConfig.isLive = isLive;
    }

    govtDoc.updatedBy = req.user?.id || 'SUPER_ADMIN';
    govtDoc.auditHistory.push({
      action: `UPDATED_HOTLINE_${govtDoc.hotlineConfig.number}_${govtDoc.hotlineConfig.isLive ? 'LIVE' : 'OFF'}`,
      changedBy: req.user?.id || 'SUPER_ADMIN',
      changedAt: new Date(),
    });

    await govtDoc.save();

    await AuditLog.create({
      user: String(req.user?.id || 'SUPER_ADMIN'),
      role: 'SuperAdmin',
      action: 'UPDATED_LIVE_HOTLINE_CONFIG',
      category: 'ADMIN',
      ipAddress: req.clientIp || req.ip,
      details: govtDoc.hotlineConfig,
    }).catch(() => {});

    broadcastKillSwitchUpdate({ killType: 'HOTLINE', hotlineConfig: govtDoc.hotlineConfig });

    return res.status(200).json({
      success: true,
      message: 'Live hotline configuration updated.',
      hotlineConfig: govtDoc.hotlineConfig,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllKillSwitches,
  toggleFeatureOrUserKill,
  updateGovtComplianceSwitches,
  updateLiveHotlineConfig,
};
