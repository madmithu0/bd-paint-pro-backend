const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { success, error } = require('../utils/response');

const sendMessage = async (req, res) => {
  try {
    const { chatId, text, image } = req.body;

    if (!chatId || (!text && !image)) {
      return error(res, 'chatId and text or image are required', 400);
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user.id
    });

    if (!chat) return error(res, 'Chat not found', 404);

    const message = await Message.create({
      chat: chatId,
      sender: req.user.id,
      text: text || '',
      image: image || ''
    });

    chat.updatedAt = Date.now();
    await chat.save();

    return success(res, 'Message sent', message, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getMessages = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user.id
    });

    if (!chat) return error(res, 'Chat not found', 404);

    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name profilePic')
      .sort({ createdAt: 1 });

    return success(res, 'Messages found', messages);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { sendMessage, getMessages };