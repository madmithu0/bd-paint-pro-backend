const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const { protect, admin } = require('../middleware/authMiddleware');

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

router.get('/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

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

module.exports = router;