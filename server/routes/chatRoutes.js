const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');

// @route   POST /api/v1/chats/send
// @desc    Send a Chat Message (Text, Photo, or Voice URL) & Emit Socket Event
// @access  Protected
router.post('/send', async (req, res, next) => {
  try {
    const { receiverId, jobId, message, mediaUrl, mediaType = 'text' } = req.body;

    if (!receiverId || (!message && !mediaUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message content are required.',
      });
    }

    const newMessage = await Chat.create({
      sender: req.user.id,
      receiver: receiverId,
      job: jobId || null,
      message: message || '',
      mediaUrl: mediaUrl || null,
      mediaType,
      seen: false,
    });

    // Real-time Socket.io delivery (File 1)
    const io = req.app.get('io');
    if (io) {
      io.to(String(receiverId)).emit('receive_message', newMessage);
    }

    res.status(201).json({
      success: true,
      chat: newMessage,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/chats/:userId
// @desc    Get Chat Conversation History with a Specific User
// @access  Protected
router.get('/:userId', async (req, res, next) => {
  try {
    const otherUserId = req.params.userId;
    const currentUserId = req.user.id;

    const messages = await Chat.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/v1/chats/seen/:senderId
// @desc    Mark all messages from a sender as Seen
// @access  Protected
router.patch('/seen/:senderId', async (req, res, next) => {
  try {
    const result = await Chat.updateMany(
      {
        sender: req.params.senderId,
        receiver: req.user.id,
        seen: false,
      },
      { $set: { seen: true, seenAt: new Date() } }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(String(req.params.senderId)).emit('messages_seen', {
        byUser: req.user.id,
        seenAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
