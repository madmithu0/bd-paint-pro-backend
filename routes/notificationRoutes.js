const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

router.post('/create', protect, async (req, res) => {
  try {
    const { user, text, title, type } = req.body || {};
    if (!user || !text) {
      return res.status(400).json({ success: false, message: 'User and text required' });
    }
    const notification = await Notification.create({
      user,
      title: title || 'Notification',
      message: text,
      type: type || 'info',
      isRead: false
    });
    return res.status(201).json({ success: true, message: 'Notification created', data: notification });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: notifications });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/list/:userId', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.params.userId }).sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: notifications });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/read-all', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.json({ success: true, message: 'Notification marked as read', data: notification });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/read/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.json({ success: true, message: 'Notification marked as read', data: notification });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;