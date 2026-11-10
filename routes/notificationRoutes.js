const express = require('express');
const router = express.Router();

// Notification Create Route
router.post('/create', (req, res) => {
  const { user, text } = req.body;
  if (!user || !text) {
    return res.status(400).json({ success: false, message: 'User and text required' });
  }
  return res.json({ success: true, message: 'Notification created', data: { user, text, read: false } });
});

// Notification List Route
router.get('/list/:userId', (req, res) => {
  return res.json({ success: true, data: [] });
});

// Notification Read Route
router.put('/read/:id', (req, res) => {
  return res.json({ success: true, message: 'Notification marked as read', id: req.params.id });
});

module.exports = router;