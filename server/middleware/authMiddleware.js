const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT Token & Attach Active User to Request
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

    // Check if token belongs to verified Super Admin session
    if (decoded.role === 'SuperAdmin' && decoded.superAdminVerified === true) {
      req.user = {
        id: decoded.id || process.env.SUPER_ADMIN_ID,
        role: 'SuperAdmin',
        superAdminVerified: true,
      };
      return next();
    }

    // Standard User Verification (Customer, Mistri, Agent, Merchant)
    const user = await User.findById(decoded.id).select('-password').lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User account no longer exists.',
      });
    }

    if (!user.active || user.suspended) {
      return res.status(403).json({
        success: false,
        message: user.blockReason || 'Your account has been suspended or blocked by administrator.',
      });
    }

    req.user = {
      id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      verify: user.verify,
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

// Role-Based Access Guard
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
