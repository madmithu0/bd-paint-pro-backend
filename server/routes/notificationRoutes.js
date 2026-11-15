const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { requireRole } = require('../middleware/authMiddleware');

// @route   POST /api/v1/notifications
// @desc    Create a Notification for a User
// @access  Protected (SuperAdmin / System)
router.post('/', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { userId, title, text, type = 'info' } = req.body;

    if (!userId || !text) {
      return res.status(400).json({
        success: false,
        message: 'User ID and notification text are required.',
      });
    }

    const notification = await Notification.create({
      user: userId,
      title: title || 'System Notification',
      text,
      type,
      read: false,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(String(userId)).emit('new_notification', notification);
    }

    res.status(201).json({
      success: true,
      notification,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/notifications
// @desc    Get Logged-in User Notifications List & Unread Count
// @access  Protected
router.get('/', async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean(),
      Notification.countDocuments({ user: req.user.id, read: false }),
    ]);

    res.status(200).json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/v1/notifications/:id/read
// @desc    Mark a Notification (or 'all') as Read
// @access  Protected
router.patch('/:id/read', async (req, res, next) => {
  try {
    if (req.params.id === 'all') {
      await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });
      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read.',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
