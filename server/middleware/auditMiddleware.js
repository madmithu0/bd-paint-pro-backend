const AuditLog = require('../models/AuditLog');

const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const auditLogger = (req, res, next) => {
  if (req.path.includes('/health')) {
    return next();
  }

  const startTime = Date.now();
  const superRoute = process.env.SUPER_ADMIN_ROUTE || process.env.SUPER_ADMIN_SECRET_ROUTE || '/x9-super-2026';

  res.on('finish', async () => {
    try {
      const isMutation = MUTATION_METHODS.includes(req.method);
      const isSecurityRelevant =
        req.originalUrl.includes('/auth') ||
        req.originalUrl.includes('/kill') ||
        req.originalUrl.includes('/backup') ||
        req.originalUrl.includes('/wallet') ||
        req.originalUrl.includes(superRoute);

      if (!isMutation && !isSecurityRelevant) {
        return;
      }

      let category = 'GENERAL';
      if (req.originalUrl.includes('reset-password') || req.originalUrl.includes('forgot-password')) category = 'PASSWORD_RESET';
      else if (req.originalUrl.includes('/auth')) category = 'AUTH';
      else if (req.originalUrl.includes('/kill')) category = 'KILL_SWITCH';
      else if (req.originalUrl.includes('/services')) category = 'RATE_UPDATE';
      else if (req.originalUrl.includes('terms')) category = 'ROLE_TERMS_EDIT';
      else if (req.originalUrl.includes('/wallet/verify')) category = 'WALLET_VERIFY';
      else if (req.originalUrl.includes('payout') || req.originalUrl.includes('withdraw')) category = 'PAYOUT';
      else if (req.originalUrl.includes('/payments')) category = 'PAYMENT';
      else if (req.originalUrl.includes('hide')) category = 'HIDE_TOGGLE';
      else if (req.originalUrl.includes(superRoute)) category = 'ADMIN';

      await AuditLog.create({
        user: req.user?.id ? String(req.user.id) : req.body?.phone || req.body?.email || 'GUEST',
        role: req.user?.role || 'Guest',
        action: `${req.method} ${req.originalUrl} [Status: ${res.statusCode}]`,
        category,
        ipAddress: req.clientIp || req.ip || '0.0.0.0',
        deviceInfo: req.headers['user-agent'] || 'Unknown Device',
        details: {
          statusCode: res.statusCode,
          durationMs: Date.now() - startTime,
          cfRay: req.cfRay || 'N/A',
        },
        time: new Date(),
      });
    } catch (err) {
      console.error('[AUDIT LOGGER ERROR]:', err.message);
    }
  });

  next();
};

module.exports = { auditLogger };
