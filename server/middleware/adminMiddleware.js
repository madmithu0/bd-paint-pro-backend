const jwt = require('jsonwebtoken');
const AuditLog = require('../models/AuditLog');

// Auto-hide check permanently bypassed
const checkHideState = (req, res, next) => {
  return next();
};

const superAdminGate = async (req, res, next) => {
  try {
    const openVerifyPaths = [
      '/send-otps',
      '/verify-4-layer',
      '/hardware-recovery',
      '/hide-status',
      '/voice-status',
      '/enroll-voice',
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

    const configuredAdminId = (process.env.SUPER_ADMIN_ID || '').trim();
    const is4LayerGreen =
      decoded.role === 'SuperAdmin' &&
      Boolean(configuredAdminId) &&
      decoded.superAdminId === configuredAdminId &&
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
      }).catch(() => {});

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
