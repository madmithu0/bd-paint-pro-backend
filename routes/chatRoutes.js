const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');

router.post('/', async (req, res) => {
  try {
    const { receiverId, message } = req.body || {};
    if (!receiverId || !message?.trim()) return res.status(400).json({ success: false, message: 'receiverId and message required' });
    if (String(message).length > 2000) return res.status(400).json({ success: false, message: 'Message too long' });
    const chat = await Chat.create({ sender: req.user._id, receiver: receiverId, message: String(message).trim() });
    res.status(201).json({ success: true, data: chat });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 30));
    const skip = (page - 1) * limit;
    const chats = await Chat.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ]
    }).sort({ createdAt: -1 }).skip(skip).limit(limit);
    res.json({ success: true, data: chats.reverse(), page });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/seen', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    if (String(chat.receiver) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    chat.seen = true;
    await chat.save();
    res.json({ success: true, data: chat });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;