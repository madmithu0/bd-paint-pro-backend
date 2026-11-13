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

// ===== পুরাতন Route - একই আছে, হাত দিই নাই =====
router.post('/register', authLimiter, registerHandler);
router.post('/signup', authLimiter, registerHandler);
router.post('/login', authLimiter, loginHandler);
router.get('/me', protect, meHandler);
router.post('/otp-send', authLimiter, auth.sendOtp);
router.post('/otp-verify', authLimiter, auth.verifyOtp);
router.post('/forgot', authLimiter, auth.forgot);

// ===== নতুন ১. Merchant বানাবে শুধু Super Admin =====
// POST /api/v1/auth/merchant-create
// Header: Authorization: Bearer <super-admin-token>
// Body: { phone, name, shopName }
router.post('/merchant-create', protect, async (req, res) => {
  try {
    // শুধু Super Admin পারবে
    if (!req.user || req.user.role !== 'super-admin') {
      return res.status(403).json({ success: false, message: 'শুধু Super Admin Merchant বানাতে পারবে' });
    }

    const { phone, name, shopName } = req.body;
    if (!phone || phone.length < 11 || !name) {
      return res.status(400).json({ success: false, message: 'Merchant এর নাম + সঠিক ফোন দাও' });
    }

    // যদি Controller এ createMerchant থাকে, ঐটা ব্যবহার করবে
    if (auth.createMerchant) {
      return auth.createMerchant(req, res);
    }

    // না থাকলে Demo Response - Controller এ পরে DB Save বসাতে হবে
    return res.json({
      success: true,
      message: 'Merchant বানানো হইছে: ' + name,
      merchant: { phone, name, shopName: shopName || '', role: 'merchant', createdBy: 'super-admin' }
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Merchant বানানো যায় নাই' });
  }
});

// ===== নতুন ২. টাকার ভাগ হিসাব - ব্লুপ্রিন্ট LOCK =====
// POST /api/v1/auth/split
// Body: { total, hasAgent: true/false }
router.post('/split', (req, res) => {
  const total = Number(req.body.total) || 0;
  const hasAgent = req.body.hasAgent === true || req.body.hasAgent === 'true';

  const split = {
    total,
    mistri: total * 0.80, // ৮০%
    agent: hasAgent ? total * 0.05 : 0, // থাকলে ৫%, না থাকলে ০
    platform: hasAgent ? total * 0.15 : total * 0.20, // Super Admin - ১৫% বা ২০%
  };

  return res.json({ success: true, split });
});

module.exports = router;