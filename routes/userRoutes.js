const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { getProfile, updateProfile, getWorkerProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/worker/:id', getWorkerProfile);

router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'super_admin' } })
      .select('-password')
      .limit(100);
    res.json({ success: true, data: users });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user || user.role === 'super_admin') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/block', protect, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'super_admin') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.isBlocked = req.body.isBlocked === true;
    await user.save();
    res.json({ success: true, data: user });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;