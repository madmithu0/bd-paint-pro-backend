const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const { protect, admin } = require('../middleware/authMiddleware');

// ===== টাকার ভাগ - ব্লুপ্রিন্ট LOCK =====
function getSplit(total, hasAgent) {
  return {
    total,
    mistri: total * 0.80, // ৮০%
    agent: hasAgent ? total * 0.05 : 0, // থাকলে ৫%
    platform: hasAgent ? total * 0.15 : total * 0.20, // তুমি - ১৫% / ২০%
  };
}

// ===== পুরাতন ১. Dashboard - একই আছে =====
router.get('/dashboard', protect, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalJobs = await Job.countDocuments();
    const completedJobs = await Job.countDocuments({ status: 'completed' });
    const pendingJobs = await Job.countDocuments({ status: 'pending' });
    const totalPayments = await Payment.countDocuments();
    return res.json({ success: true, data: { totalUsers, totalJobs, completedJobs, pendingJobs, totalPayments } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== পুরাতন ২. Users লিস্ট - একই আছে =====
router.get('/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== পুরাতন ৩. Block - একই আছে =====
router.patch('/users/:id/block', protect, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true }, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, message: 'User blocked', data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== পুরাতন ৪. Unblock - একই আছে =====
router.patch('/users/:id/unblock', protect, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false }, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, message: 'User unblocked', data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== পুরাতন ৫. Delete - একই আছে =====
router.delete('/users/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== নতুন ১. Merchant বানাবে শুধু Super Admin =====
// POST /api/v1/super/merchant-create { phone, name, shopName }
router.post('/merchant-create', protect, admin, async (req, res) => {
  try {
    const { phone, name, shopName } = req.body;
    if (!phone || phone.length < 11 || !name) {
      return res.status(400).json({ success: false, message: 'Merchant এর নাম + সঠিক ফোন দাও - 01XXXXXXXXX' });
    }

    // একই ফোনে আগেই Merchant আছে কিনা চেক
    const exists = await User.findOne({ phone, role: 'merchant' });
    if (exists) {
      return res.status(400).json({ success: false, message: 'এই ফোনে Merchant আগেই আছে' });
    }

    const merchant = await User.create({
      name,
      phone,
      shopName: shopName || '',
      role: 'merchant',
      isVerified: true,
      isBlocked: false,
      password: 'merchant-' + Date.now(), // পরে Super Admin পাসওয়ার্ড বদলায় দিবে
    });

    return res.json({ success: true, message: 'Merchant বানানো হইছে: ' + name, data: { id: merchant._id, name, phone, shopName: merchant.shopName, role: 'merchant' } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Merchant বানানো যায় নাই' });
  }
});

// ===== নতুন ২. Merchant লিস্ট =====
// GET /api/v1/super/merchants
router.get('/merchants', protect, admin, async (req, res) => {
  try {
    const merchants = await User.find({ role: 'merchant' }).select('-password').sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: merchants });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== নতুন ৩. টাকার ভাগ হিসাব =====
// POST /api/v1/super/split { total, hasAgent }
router.post('/split', protect, admin, async (req, res) => {
  const total = Number(req.body.total) || 0;
  const hasAgent = req.body.hasAgent === true || req.body.hasAgent === 'true';
  return res.json({ success: true, data: getSplit(total, hasAgent) });
});

module.exports = router;