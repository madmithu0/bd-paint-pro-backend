const jwt = require('jsonwebtoken');
const AuditLog = require('../models/AuditLog');

const checkHideState = (req, res, next) => {
  return next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or SuperAdmin privileges required.',
    });
  }
  next();
};

const superAdminGate = async (req, res, next) => {
  try {
    const openVerifyPaths = [
      '/login',
      '/login-password',
      '/send-otps',
      '/verify-2fa',
      '/verify-4-layer',
      '/hardware-recovery',
      '/hide-status',
    ];
    if (openVerifyPaths.some((p) => req.path.endsWith(p))) {
      return next();
    }

    const authHeader = req.headers.authorization;
    const headerToken = req.headers['x-super-token'];
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (headerToken) {
      token = String(headerToken).trim();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Super Admin Password + 2FA Session Token required.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const configuredAdminId = (process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim();
    const hasPasswordAuth =
      decoded.passwordVerified === true ||
      decoded.superAdminVerified === true ||
      decoded.layers?.passwordVerified === true;

    const has2FA =
      decoded.twoFactorVerified === true ||
      decoded.layers?.phoneOtp === true ||
      decoded.layers?.gmailOtp === true;

    const isVerifiedSuperAdmin =
      decoded.role === 'SuperAdmin' &&
      Boolean(configuredAdminId) &&
      (decoded.superAdminId === configuredAdminId || decoded.id === configuredAdminId) &&
      hasPasswordAuth &&
      has2FA;

    if (!isVerifiedSuperAdmin) {
      await AuditLog.create({
        user: 'UNKNOWN_INTRUDER',
        role: 'Unauthorized',
        action: 'INCOMPLETE_SUPER_ADMIN_2FA_ATTEMPT',
        category: 'ADMIN',
        ipAddress: req.clientIp || req.ip,
        details: { path: req.originalUrl },
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        message: 'Super Admin Password + Phone/Gmail 2FA verification incomplete.',
      });
    }

    req.user = {
      id: decoded.superAdminId || decoded.id,
      role: 'SuperAdmin',
      superAdminVerified: true,
      twoFactorVerified: true,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Super Admin session invalid or expired. Please re-authenticate.',
    });
  }
};

const verifyTransactionPin = (req, res, next) => {
  const providedPin = String(req.headers['x-transaction-pin'] || req.body?.transactionPin || '').trim();
  const configuredPin = String(process.env.SUPER_ADMIN_TRANSACTION_PIN || process.env.TRANSACTION_PIN || '').trim();

  if (!configuredPin || !providedPin || providedPin !== configuredPin) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing Super Admin Transaction PIN.',
    });
  }
  next();
};

module.exports = { checkHideState, requireAdmin, superAdminGate, verifyTransactionPin };
