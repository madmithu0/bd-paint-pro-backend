const jwt = require('jsonwebtoken');
const hideConfig = require('../config/hideConfig');
const AuditLog = require('../models/AuditLog');

// 1. Hide State Gate: Blocks discovery when Hide Mode is ON unless ID + IP + Token match
const checkHideState = (req, res, next) => {
  if (!hideConfig.isHidden()) {
    return next();
  }

  const adminId = req.headers['x-super-admin-id'] || req.query.adminId;
  const secretToken = req.headers['x-super-token'] || req.headers.authorization?.split(' ')[1];
  const clientIp = req.clientIp || req.ip;

  const allowed = hideConfig.canSeeHidden({
    adminId,
    clientIp,
    secretToken,
  });

  if (!allowed) {
    // Return 404 to completely conceal the existence of the route
    return res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  }

  next();
};

// 2. Super Admin Backdoor & 4-Layer Verification Gate
const superAdminGate = async (req, res, next) => {
  try {
    // Allow initial verification endpoints (sending OTP, verifying 4 layers, hardware recovery)
    const openVerifyPaths = [
      '/send-otps',
      '/verify-4-layer',
      '/hardware-recovery',
      '/hide-status',
    ];
    if (openVerifyPaths.some((p) => req.path.endsWith(p))) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Super Admin 4-Layer Session Token required.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Strictly verify all 4 layers (Phone OTP + Gmail OTP + Live Voice + Live 3D Face)
    const is4LayerGreen =
      decoded.role === 'SuperAdmin' &&
      decoded.superAdminId === process.env.SUPER_ADMIN_ID &&
      decoded.layers?.phoneOtp === true &&
      decoded.layers?.gmailOtp === true &&
      decoded.layers?.voiceVerified === true &&
      decoded.layers?.face3DVerified === true;

    if (!is4LayerGreen) {
      await AuditLog.create({
        user: 'UNKNOWN_INTRUDER',
        role: 'Unauthorized',
        action: 'INCOMPLETE_4_LAYER_BYPASS_ATTEMPT',
        category: 'BIOMETRIC_FAIL',
        ipAddress: req.clientIp || req.ip,
        details: { path: req.originalUrl },
      });

      return res.status(403).json({
        success: false,
        message: '4-Layer Biometric & OTP Verification incomplete. All 4 layers must be green.',
      });
    }

    req.user = {
      id: decoded.superAdminId,
      role: 'SuperAdmin',
      superAdminVerified: true,
      layers: decoded.layers,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Super Admin session invalid or expired. Re-verify all 4 layers.',
    });
  }
};

module.exports = { checkHideState, superAdminGate };
