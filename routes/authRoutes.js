const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts' }
});

const registerHandler = auth.signup || auth.register;
const loginHandler = auth.login;
const meHandler = auth.getMe || auth.me;

router.post('/register', authLimiter, registerHandler);
router.post('/signup', authLimiter, registerHandler);
router.post('/login', authLimiter, loginHandler);
router.get('/me', protect, meHandler);
router.post('/otp-send', authLimiter, auth.sendOtp);
router.post('/otp-verify', authLimiter, auth.verifyOtp);
router.post('/forgot', authLimiter, auth.forgot);

module.exports = router;