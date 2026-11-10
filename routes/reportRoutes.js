const express = require('express');
const router = express.Router();

// Report Job Route
router.get('/job', (req, res) => {
  return res.json({ success: true, message: 'Job report', data: [] });
});

// Report Payment Route
router.get('/payment', (req, res) => {
  return res.json({ success: true, message: 'Payment report', data: [] });
});

// Report Export Route
router.get('/export', (req, res) => {
  return res.json({ success: true, message: 'Report export ready', data: [] });
});

module.exports = router;