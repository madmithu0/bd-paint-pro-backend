const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authorization token missing.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'SuperAdmin' && decoded.superAdminVerified === true) {
      req.user = {
        id: decoded.id || process.env.SUPER_ADMIN_ID,
        role: 'SuperAdmin',
        superAdminVerified: true,
      };
      return next();
    }

    const user = await User.findById(decoded.id).select('-passwordHash').lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User account no longer exists.',
      });
    }

    if (user.passwordChangedAt && decoded.iat) {
      const changedTimestamp = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({
          success: false,
          message: 'Password was recently changed. Please login again.',
          code: 'PASSWORD_CHANGED',
        });
      }
    }

    if (!user.active || user.suspended || user.accountStatus === 'Suspended' || user.accountStatus === 'Banned' || user.penaltyStatus === 'Suspended') {
      return res.status(403).json({
        success: false,
        message: user.blockReason || 'Your account has been suspended or blocked by administrator.',
      });
    }

    const isConsentRoute = req.originalUrl.includes('/accept-terms') || req.originalUrl.includes('/logout');
    if (user.role === 'Merchant' && !user.merchantCommissionAgreed && !isConsentRoute) {
      return res.status(403).json({
        success: false,
        message: 'Merchant commission agreement acceptance is required prior to account activation.',
        code: 'COMMISSION_AGREEMENT_REQUIRED',
      });
    }

    req.user = {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      verify: user.verify,
      termsAcceptedVersion: user.termsAcceptedVersion,
      merchantCommissionAgreed: user.merchantCommissionAgreed,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please refresh token or login again.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.',
    });
  }
};

const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access forbidden. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };
