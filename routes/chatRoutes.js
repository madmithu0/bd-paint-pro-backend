const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const { getMyChats, getChatById } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, async (req, res) => {
  try {
    const { receiverId, message } = req.body || {};
    if (!receiverId || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'receiverId and message required' });
    }
    if (String(message).length > 2000) {
      return res.status(400).json({ success: false, message: 'Message too long' });
    }
    const chat = await Chat.create({
      sender: req.user._id || req.user.id,
      receiver: receiverId,
      message: String(message).trim()
    });
    res.status(201).json({ success: true, data: chat });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my', protect, getMyChats);

router.get('/:userId', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 30));
    const skip = (page - 1) * limit;

    const chats = await Chat.find({
      $or: [
        { sender: userId, receiver: req.params.userId },
        { sender: req.params.userId, receiver: userId }
      ]
    }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    res.json({ success: true, data: chats.reverse(), page });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/id/:id', protect, getChatById);

router.patch('/:id/seen', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }
    if (String(chat.receiver) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    chat.seen = true;
    await chat.save();
    res.json({ success: true, data: chat });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;