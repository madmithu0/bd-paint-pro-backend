const express = require('express');
const router = express.Router();

// Wallet Show Route
router.get('/show/:userId', (req, res) => {
  return res.json({ success: true, user: req.params.userId, balance: 0 });
});

// Wallet Transaction Route
router.get('/transactions/:userId', (req, res) => {
  return res.json({ success: true, user: req.params.userId, data: [] });
});

// Wallet Withdraw Route
router.post('/withdraw', (req, res) => {
  const { user, amount } = req.body;
  if (!user || !amount) {
    return res.status(400).json({ success: false, message: 'User and amount required' });
  }
  return res.json({ success: true, message: 'Withdraw request created', data: { user, amount, status: 'pending' } });
});

// Wallet Withdraw History Route
router.get('/withdraw/history/:userId', (req, res) => {
  return res.json({ success: true, user: req.params.userId, data: [] });
});

module.exports = router;