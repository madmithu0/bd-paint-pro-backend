const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/authController');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts' }
});

router.post('/login', authLimiter, auth.login);
router.post('/signup', authLimiter, auth.signup);
router.post('/otp-send', authLimiter, auth.sendOtp);
router.post('/otp-verify', authLimiter, auth.verifyOtp);
router.post('/forgot', authLimiter, auth.forgot);

module.exports = router;