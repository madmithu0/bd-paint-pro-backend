const express = require('express');
const router = express.Router();

// Invoice Create Route
router.post('/create', (req, res) => {
  const { job, amount } = req.body;
  if (!job || !amount) {
    return res.status(400).json({ success: false, message: 'Job and amount required' });
  }
  return res.json({ success: true, message: 'Invoice created', data: { job, amount } });
});

// Invoice List Route
router.get('/list', (req, res) => {
  return res.json({ success: true, data: [] });
});

// Invoice Download Route
router.get('/download/:id', (req, res) => {
  return res.json({ success: true, message: 'Invoice download ready', id: req.params.id });
});

module.exports = router;