const Kill = require('../models/Kill');
const AuditLog = require('../models/AuditLog');

const ALWAYS_ACTIVE_WHITELIST = [
  '/health',
  '/x9-super-2026',
  '/webhooks',
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const checkKillSwitch = async (req, res, next) => {
  try {
    const currentPath = req.path.toLowerCase();
    const secretRoute = (process.env.SUPER_ADMIN_ROUTE || process.env.SUPER_ADMIN_SECRET_ROUTE || '/x9-super-2026').toLowerCase();

    if (
      currentPath.startsWith(secretRoute) ||
      ALWAYS_ACTIVE_WHITELIST.some((allowed) => currentPath.startsWith(allowed))
    ) {
      return next();
    }

    const govtConfig = await Kill.findOne({ killType: 'GOVT' }).lean();
    req.govtFlags = govtConfig?.govtFeatureFlags || {
      autoVatEnabled: false,
      nbrBinMandateEnabled: false,
      govtAuditEnabled: false,
    };

    const activeKills = await Kill.find({ status: true, killType: { $in: ['FEATURE', 'USER', 'GOVT'] } }).lean();
    if (!activeKills || activeKills.length === 0) {
      return next();
    }

    const featureKill = activeKills.find(
      (k) => (k.killType === 'FEATURE' || k.killType === 'GOVT') && currentPath.includes(k.target.toLowerCase())
    );
    if (featureKill) {
      return res.status(503).json({
        success: false,
        killed: true,
        feature: featureKill.target,
        message: featureKill.reason || `The [${featureKill.target}] module is currently disabled by administrator.`,
      });
    }

    const targetUserId = req.user?.id || req.headers['x-user-id'];
    if (targetUserId) {
      const userKill = activeKills.find(
        (k) => k.killType === 'USER' && String(k.target) === String(targetUserId)
      );
      if (userKill) {
        await AuditLog.create({
          user: String(targetUserId),
          action: 'KILLED_USER_ACCESS_BLOCKED',
          category: 'KILL_SWITCH',
          ipAddress: req.clientIp || req.ip,
        }).catch(() => {});

        return res.status(403).json({
          success: false,
          killed: true,
          message: userKill.reason || 'Your account operations have been halted by administrator.',
        });
      }
    }

    next();
  } catch (error) {
    console.error('[KILL MIDDLEWARE ERROR]:', error.message);
    next();
  }
};

module.exports = { checkKillSwitch };
