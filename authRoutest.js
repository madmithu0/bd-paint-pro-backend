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

function validateLogin(req, res, next) {
  const { phone, email, password } = req.body || {};
  if ((!phone && !email) || !password) {
    return res.status(400).json({ success: false, message: 'Phone/email and password required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password too short' });
  }
  next();
}

function validateSignup(req, res, next) {
  const { name, phone, password, role } = req.body || {};
  if (!name || !phone || !password) {
    return res.status(400).json({ success: false, message: 'Name, phone, password required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password too short' });
  }
  if (role && !['customer', 'mistri', 'agent', 'merchant'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }
  if (role === 'super_admin') {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }
  next();
}

function validateOtp(req, res, next) {
  const { phone, code } = req.body || {};
  if (!phone || !code || String(code).length !== 6) {
    return res.status(400).json({ success: false, message: 'Valid phone and 6 digit code required' });
  }
  next();
}

router.post('/login', authLimiter, validateLogin, auth.login);
router.post('/signup', authLimiter, validateSignup, auth.signup);
router.post('/otp-send', authLimiter, (req, res, next) => {
  if (!req.body?.phone) return res.status(400).json({ success: false, message: 'Phone required' });
  next();
}, auth.sendOtp);
router.post('/otp-verify', authLimiter, validateOtp, auth.verifyOtp);
router.post('/forgot', authLimiter, (req, res, next) => {
  if (!req.body?.phone && !req.body?.email) return res.status(400).json({ success: false, message: 'Phone or email required' });
  next();
}, auth.forgot);

module.exports = router;