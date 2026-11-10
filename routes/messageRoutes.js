const express = require('express');
const router = express.Router();
const { sendMessage, getMessagesByChat, markAsSeen } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, sendMessage);
router.get('/chat/:chatId', protect, getMessagesByChat);
router.patch('/:id/seen', protect, markAsSeen);

module.exports = router;