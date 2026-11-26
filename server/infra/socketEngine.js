const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Job = require('../models/Job');
const Chat = require('../models/Chat');

let ioInstance = null;
const onlineUsers = new Map();

const verifyChatGate = async (jobId) => {
  if (!jobId) return false;
  const job = await Job.findById(jobId).select('milestone1Paid milestoneStages').lean();
  if (!job) return false;
  return Boolean(job.milestone1Paid || job.milestoneStages?.stage1Paid);
};

const initSocketEngine = (httpServer, corsOptions = {}) => {
  ioInstance = new Server(httpServer, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  ioInstance.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Socket authentication token required'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        id: String(decoded.id || decoded.superAdminId),
        role: decoded.role,
      };
      next();
    } catch (err) {
      next(new Error('Invalid or expired socket token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const userId = socket.user.id;
    onlineUsers.set(userId, socket.id);
    socket.join(`user_${userId}`);
    ioInstance.emit('user_presence', { userId, online: true });

    socket.on('join_job_room', async ({ jobId }) => {
      if (!jobId) return;
      socket.join(`job_${jobId}`);
      const unlocked = await verifyChatGate(jobId);
      socket.emit('chat_gate_status', { jobId, unlocked });
    });

    socket.on('send_message', async (payload, callback) => {
      try {
        const { jobId, receiverId, message, mediaUrl } = payload || {};
        if (!jobId || !receiverId || (!message && !mediaUrl)) {
          if (callback) callback({ success: false, message: 'Invalid chat payload' });
          return;
        }

        const isUnlocked = await verifyChatGate(jobId);
        if (!isUnlocked) {
          const errorPayload = {
            success: false,
            locked: true,
            message: 'Live chat is locked until 30% advance escrow payment is verified.',
          };
          socket.emit('chat_locked_alert', errorPayload);
          if (callback) callback(errorPayload);
          return;
        }

        const savedMessage = await Chat.create({
          sender: userId,
          receiver: receiverId,
          jobId,
          message: message || '',
          mediaUrl: mediaUrl || '',
          delivered: onlineUsers.has(String(receiverId)),
        });

        ioInstance.to(`job_${jobId}`).to(`user_${receiverId}`).emit('receive_message', savedMessage);
        if (callback) callback({ success: true, data: savedMessage });
      } catch (err) {
        if (callback) callback({ success: false, message: 'Message delivery failed' });
      }
    });

    socket.on('mark_seen', async ({ jobId, messageIds }) => {
      if (!jobId || !Array.isArray(messageIds) || messageIds.length === 0) return;
      await Chat.updateMany({ _id: { $in: messageIds }, receiver: userId }, { $set: { seen: true } });
      ioInstance.to(`job_${jobId}`).emit('messages_seen', { jobId, messageIds, seenBy: userId });
    });
    socket.on('typing', ({ jobId, isTyping }) => {
      if (jobId) {
        socket.to(`job_${jobId}`).emit('user_typing', { jobId, userId, isTyping: Boolean(isTyping) });
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      ioInstance.emit('user_presence', { userId, online: false });
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

const broadcastChatAndContactUnlock = (jobId, customerId, mistriIds = []) => {
  if (!ioInstance) return;
  const payload = {
    jobId: String(jobId),
    unlocked: true,
    message: '30% Advance Escrow verified! Mistri phone number and live chat are now unlocked.',
    unlockedAt: new Date().toISOString(),
  };
  ioInstance.to(`job_${jobId}`).to(`user_${customerId}`).emit('chat_unlocked', payload);
  mistriIds.forEach((mId) => {
    ioInstance.to(`user_${mId}`).emit('chat_unlocked', payload);
  });
};

const broadcastMilestoneUpdate = (jobId, milestoneData) => {
  if (!ioInstance) return;
  ioInstance.to(`job_${jobId}`).emit('milestone_updated', { jobId: String(jobId), ...milestoneData });
};

const broadcastKillSwitchUpdate = (killData) => {
  if (!ioInstance) return;
  ioInstance.emit('kill_switch_updated', killData);
};

const broadcastServiceRateUpdate = (serviceData) => {
  if (!ioInstance) return;
  ioInstance.emit('service_rates_updated', serviceData);
};

module.exports = {
  init: initSocketEngine,
  initSocketEngine,
  getIO,
  broadcastChatAndContactUnlock,
  broadcastMilestoneUpdate,
  broadcastKillSwitchUpdate,
  broadcastServiceRateUpdate,
};
