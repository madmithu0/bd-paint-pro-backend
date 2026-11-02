const AuditLog = require('../models/AuditLog');

const auditLogger = (action, entityType) => {
  return async (req, res, next) => {
    // Store original json function
    const originalJson = res.json;
    
    res.json = function (data) {
      // Log only if response is success
      if (data && data.success !== false) {
        const logData = {
          userId: req.user ? req.user._id : null,
          userModel: req.user ? 'User' : null,
          action: action,
          entityType: entityType,
          entityId: req.params.id || data.data?._id || data._id || null,
          details: {
            method: req.method,
            url: req.originalUrl,
            body: req.method !== 'GET' ? req.body : undefined,
            params: req.params,
            query: req.query
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        };

        // Async log without blocking response
        AuditLog.create(logData).catch(err => {
          console.error('Audit log failed:', err.message);
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

// Simple audit log function for direct use
const createAuditLog = async ({ userId, action, entityType, entityId, details, req }) => {
  try {
    await AuditLog.create({
      userId,
      action,
      entityType,
      entityId,
      details,
      ipAddress: req ? req.ip : null,
      userAgent: req ? req.get('User-Agent') : null
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

module.exports = { auditLogger, createAuditLog };