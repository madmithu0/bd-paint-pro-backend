const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authRateLimiter } = require('../middleware/rateLimitMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const safeRequireModel = (modelPath) => {
  try {
    return require(modelPath);
  } catch (err) {
    return null;
  }
};

const RoleTerms = safeRequireModel('../models/RoleTerms');
const verifyJwt = authMiddleware.protect || authMiddleware.verifyToken || authMiddleware;

const ALLOWED_PUBLIC_ROLES = ['Customer', 'Mistri', 'Agent', 'Merchant'];

const enforcePublicRoleLock = (req, res, next) => {
  const { role } = req.body;
  if (role && !ALLOWED_PUBLIC_ROLES.includes(role)) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized role selection. Access denied.',
      apiVersion: 'v1',
    });
  }
  next();
};

const enforceSignupConsent = (req, res, next) => {
  const { role, termsAcceptedVersion, merchantCommissionAgreed } = req.body;
  if (!termsAcceptedVersion) {
    return res.status(400).json({
      success: false,
      message: 'You must accept the role-specific Terms & Conditions before signup.',
      apiVersion: 'v1',
    });
  }
  if (role === 'Merchant' && merchantCommissionAgreed !== true) {
    return res.status(400).json({
      success: false,
      message: 'Merchants must agree to the platform commission terms prior to registration.',
      apiVersion: 'v1',
    });
  }
  next();
};

router.post('/signup', authRateLimiter, enforcePublicRoleLock, enforceSignupConsent, authController.signup);
router.post('/login', authRateLimiter, enforcePublicRoleLock, authController.login);
router.post('/send-otp', authRateLimiter, authController.sendOtp);
router.post('/verify-otp', authRateLimiter, authController.verifyOtp);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

router.get('/role-terms/:role', async (req, res, next) => {
  try {
    const role = req.params.role;
    if (!ALLOWED_PUBLIC_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified.' });
    }
    if (!RoleTerms) {
      return res.status(200).json({ success: true, terms: { role, version: 'v3.8.0', clauses: [] } });
    }
    const terms = await RoleTerms.findOne({ role }).lean();
    return res.status(200).json({ success: true, terms });
  } catch (error) {
    next(error);
  }
});

router.post('/accept-terms', verifyJwt, async (req, res, next) => {
  try {
    const { termsAcceptedVersion, merchantCommissionAgreed } = req.body;
    if (!termsAcceptedVersion) {
      return res.status(400).json({ success: false, message: 'Terms version is required.' });
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'Merchant' && !merchantCommissionAgreed && !user.merchantCommissionAgreed) {
      return res.status(400).json({ success: false, message: 'Merchant commission agreement is mandatory.' });
    }

    user.termsAcceptedVersion = String(termsAcceptedVersion).trim();
    if (user.role === 'Merchant' && merchantCommissionAgreed !== undefined) {
      user.merchantCommissionAgreed = Boolean(merchantCommissionAgreed);
    }
    await user.save();

    await AuditLog.create({
      user: String(user._id),
      role: user.role,
      action: 'ROLE_TERMS_ACCEPTED',
      category: 'LEGAL',
      ipAddress: req.ip || '',
      details: { termsAcceptedVersion: user.termsAcceptedVersion },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Terms & conditions consent recorded successfully.',
      termsAcceptedVersion: user.termsAcceptedVersion,
      merchantCommissionAgreed: user.merchantCommissionAgreed,
    });
  } catch (error) {
    next(error);
  }
});

if (authController.changePassword) {
  router.post('/change-password', verifyJwt, authController.changePassword);
}

module.exports = router;
