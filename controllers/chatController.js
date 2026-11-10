const Chat = require('../models/Chat');
const { success, error } = require('../utils/response');

const createChat = async (req, res) => {
  try {
    const { receiverId, jobId } = req.body;

    if (!receiverId) {
      return error(res, 'receiverId is required', 400);
    }

    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, receiverId] },
      job: jobId || null
    });

    if (chat) return success(res, 'Chat found', chat);

    chat = await Chat.create({
      participants: [req.user.id, receiverId],
      job: jobId || null
    });

    return success(res, 'Chat created', chat, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getMyChats = async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user.id })
      .populate('participants', 'name profilePic role')
      .sort({ updatedAt: -1 });

    return success(res, 'Chats found', chats);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getChatById = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user.id
    }).populate('participants', 'name profilePic role');

    if (!chat) return error(res, 'Not found', 404);
    return success(res, 'Chat found', chat);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { createChat, getMyChats, getChatById };