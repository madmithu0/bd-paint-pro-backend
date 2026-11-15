const Kill = require('../models/Kill');
const AuditLog = require('../models/AuditLog');

const ALWAYS_ACTIVE_WHITELIST = ['/health', '/x9-super-2026', '/webhooks'];

const checkKillSwitch = async (req, res, next) => {
  try {
    const currentPath = req.path.toLowerCase();

    // Super Admin Verify & Health Endpoints can NEVER be killed (Always Active Lock)
    const secretRoute = (process.env.SUPER_ADMIN_SECRET_ROUTE || '/x9-super-2026').toLowerCase();
    if (
      currentPath.startsWith(secretRoute) ||
      ALWAYS_ACTIVE_WHITELIST.some((allowed) => currentPath.startsWith(allowed))
    ) {
      return next();
    }

    // Fetch active kill switches
    const activeKills = await Kill.find({ status: true }).lean();
    if (!activeKills || activeKills.length === 0) {
      return next();
    }

    // 1. Check Global System Kill Switch
    const globalKill = activeKills.find((k) => k.killType === 'GLOBAL');
    if (globalKill) {
      return res.status(503).json({
        success: false,
        killed: true,
        message: globalKill.reason || 'System is temporarily paused by Super Admin maintenance switch.',
      });
    }

    // 2. Check Feature-Specific Kill Switch (e.g., 'JOBS', 'PAYMENTS', 'SIGNUP')
    const featureKill = activeKills.find(
      (k) => k.killType === 'FEATURE' && currentPath.includes(k.target.toLowerCase())
    );
    if (featureKill) {
      return res.status(503).json({
        success: false,
        killed: true,
        feature: featureKill.target,
        message: featureKill.reason || `The [${featureKill.target}] module is currently disabled.`,
      });
    }

    // 3. Check Specific User Kill Switch (if user ID is decoded or passed in header)
    const targetUserId = req.user?.id || req.headers['x-user-id'];
    if (targetUserId) {
      const userKill = activeKills.find(
        (k) => k.killType === 'USER' && String(k.target) === String(targetUserId)
      );
      if (userKill) {
        await AuditLog.create({
          user: String(targetUserId),
          action: 'KILLED_USER_ACCESS_BLOCKED',
          category: 'ADMIN',
          ipAddress: req.clientIp || req.ip,
        });

        return res.status(403).json({
          success: false,
          killed: true,
          message: userKill.reason || 'Your account operations have been halted by Super Admin.',
        });
      }
    }

    next();
  } catch (error) {
    // Fail-open safely if DB query glitches so self-healing continues
    console.error('[KILL MIDDLEWARE ERROR]:', error.message);
    next();
  }
};

module.exports = { checkKillSwitch };
