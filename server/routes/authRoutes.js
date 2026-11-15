const express = require('express');
const router = express.Router();

// Safe Controller & Middleware Loader
const authController = require('../controllers/authController');
const { authRateLimiter } = require('../middleware/rateLimitMiddleware');

const ALLOWED_PUBLIC_ROLES = ['Customer', 'Mistri', 'Agent', 'Merchant'];

// Role Guard Middleware: Blocks any attempt to register/login as Super Admin via public routes
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

// @route   POST /api/v1/auth/signup
// @desc    Register new Customer, Mistri, Agent, or Merchant (Super Admin blocked)
// @access  Public (Rate Limited)
router.post('/signup', authRateLimiter, enforcePublicRoleLock, authController.signup);

// @route   POST /api/v1/auth/login
// @desc    Login with Email or Phone & Password
// @access  Public (Rate Limited)
router.post('/login', authRateLimiter, enforcePublicRoleLock, authController.login);

// @route   POST /api/v1/auth/send-otp
// @desc    Send Phone/Email OTP for Verification
// @access  Public (Rate Limited)
router.post('/send-otp', authRateLimiter, authController.sendOtp);

// @route   POST /api/v1/auth/verify-otp
// @desc    Verify OTP Code
// @access  Public (Rate Limited)
router.post('/verify-otp', authRateLimiter, authController.verifyOtp);

// @route   POST /api/v1/auth/forgot-password
// @desc    Request Password Reset OTP/Link
// @access  Public (Rate Limited)
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);

// @route   POST /api/v1/auth/reset-password
// @desc    Reset Password after OTP verification
// @access  Public (Rate Limited)
router.post('/reset-password', authRateLimiter, authController.resetPassword);

// @route   POST /api/v1/auth/refresh-token
// @desc    Rotate Access & Refresh JWT Tokens (File 74)
// @access  Public
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
