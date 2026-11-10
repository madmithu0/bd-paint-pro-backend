const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/', async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'super_admin' } }).select('-password').limit(100);
    res.json({ success: true, data: users });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'super_admin') return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/block', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'super_admin') return res.status(404).json({ success: false, message: 'User not found' });
    user.isBlocked = req.body.isBlocked === true;
    await user.save();
    res.json({ success: true, data: user });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;