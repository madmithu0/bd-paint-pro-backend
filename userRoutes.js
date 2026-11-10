const express = require('express');
const router = express.Router();
const User = require('../models/User');
const adminMiddleware = require('../middleware/adminMiddleware');

router.get('/', adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find({ role: { $ne: 'super_admin' } }).select('-password').skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments({ role: { $ne: 'super_admin' } })
    ]);
    res.json({ success: true, data: users, page, totalPages: Math.ceil(total / limit), total });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user || user.role === 'super_admin') return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/block', adminMiddleware, async (req, res) => {
  try {
    if (typeof req.body?.isBlocked !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isBlocked boolean required' });
    }
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'super_admin') return res.status(404).json({ success: false, message: 'User not found' });
    user.isBlocked = req.body.isBlocked;
    await user.save();
    res.json({ success: true, data: { id: user._id, isBlocked: user.isBlocked } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;