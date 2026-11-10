const Notification = require('../models/Notification');
const { success, error } = require('../utils/response');

const createNotification = async (req, res) => {
  try {
    const { user, title, message, type } = req.body;

    if (!user || !title || !message) {
      return error(res, 'user, title and message are required', 400);
    }

    const notification = await Notification.create({
      user,
      title,
      message,
      type: type || 'info',
      isRead: false
    });

    return success(res, 'Notification created', notification, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);

    return success(res, 'Notifications found', notifications);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) return error(res, 'Not found', 404);
    return success(res, 'Notification marked as read', notification);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true }
    );

    return success(res, 'All notifications marked as read');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const deleteNotification = async (req, res) => {
  try {
    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!deleted) return error(res, 'Not found', 404);
    return success(res, 'Notification deleted');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};