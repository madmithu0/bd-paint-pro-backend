const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Job = require('../models/Job');
const { enforceAdvancePaymentGate } = require('../middleware/advancePaymentGate');

const maskPhoneNumbersInText = (text) => {
  if (!text) return '';
  return String(text).replace(/(?:\+?88)?01[3-9]\d{8}/g, '[PHONE_BLOCKED]');
};

router.post('/send', enforceAdvancePaymentGate, async (req, res, next) => {
  try {
    const { receiverId, jobId, message, mediaUrl, mediaType = 'text' } = req.body;

    if (!receiverId || (!message && !mediaUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message content are required.',
      });
    }

    const sanitizedMessage = maskPhoneNumbersInText(message);

    const newMessage = await Chat.create({
      sender: req.user.id,
      receiver: receiverId,
      job: jobId || null,
      message: sanitizedMessage,
      mediaUrl: mediaUrl || null,
      mediaType,
      seen: false,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(String(receiverId)).emit('receive_message', newMessage);
    }

    return res.status(201).json({
      success: true,
      chat: newMessage,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId', async (req, res, next) => {
  try {
    const otherUserId = req.params.userId;
    const currentUserId = req.user.id;
    const { jobId } = req.query;

    if (req.user.role !== 'SuperAdmin') {
      const jobFilter = jobId
        ? { _id: jobId }
        : {
            $or: [
              { customerId: currentUserId, assignedMistriIds: otherUserId },
              { customerId: otherUserId, assignedMistriIds: currentUserId },
            ],
          };

      const activeJob = await Job.findOne(jobFilter)
        .select('milestoneStages')
        .lean();

      const isAdvancePaid = Boolean(
        activeJob &&
          activeJob.milestoneStages &&
          activeJob.milestoneStages.stage1Paid === true
      );

      if (!isAdvancePaid) {
        return res.status(402).json({
          success: false,
          locked: true,
          code: 'ADVANCE_30_REQUIRED',
          message: '30% advance payment is required before accessing chatbox.',
        });
      }
    }

    const messages = await Chat.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    return res.status(200).json({
      success: true,
      locked: false,
      count: messages.length,
      messages,
    });
  } catch (error) {
    next(error);
  }
});
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

    return res.status(200).json({
      success: true,
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
