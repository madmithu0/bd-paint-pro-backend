const AuditLog = require('../models/AuditLog');

// Sensitive paths & methods that require strict audit logging
const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const auditLogger = (req, res, next) => {
  // Skip routine health checks to avoid log flooding
  if (req.path.includes('/health')) {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', async () => {
    try {
      const isMutation = MUTATION_METHODS.includes(req.method);
      const isSecurityRelevant =
        req.originalUrl.includes('/auth') ||
        req.originalUrl.includes('/kill') ||
        req.originalUrl.includes('/backup') ||
        req.originalUrl.includes(process.env.SUPER_ADMIN_SECRET_ROUTE || '/x9-super-2026');

      if (!isMutation && !isSecurityRelevant) {
        return;
      }

      // Determine Audit Category
      let category = 'GENERAL';
      if (req.originalUrl.includes('/auth')) category = 'AUTH';
      else if (req.originalUrl.includes('reset-password')) category = 'PASSWORD_RESET';
      else if (req.originalUrl.includes('/payments')) category = 'PAYMENT';
      else if (req.originalUrl.includes('hide')) category = 'HIDE_TOGGLE';
      else if (req.originalUrl.includes(process.env.SUPER_ADMIN_SECRET_ROUTE || '/x9-super-2026')) category = 'ADMIN';

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
      // Never crash main request if background audit logging fails
      console.error('[AUDIT LOGGER ERROR]:', err.message);
    }
  });

  next();
};

module.exports = { auditLogger };
