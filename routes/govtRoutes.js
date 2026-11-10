const express = require('express');
const router = express.Router();

// NBR Route
router.get('/nbr', (req, res) => {
  return res.json({ success: true, message: 'NBR info', data: [] });
});

// BTRC Route
router.get('/btrc', (req, res) => {
  return res.json({ success: true, message: 'BTRC info', data: [] });
});

// BIN Verify Route
router.post('/bin-verify', (req, res) => {
  const { bin } = req.body;
  if (!bin) {
    return res.status(400).json({ success: false, message: 'BIN required' });
  }
  return res.json({ success: true, message: 'BIN verified', bin, valid: true });
});

// Mushak VAT Route
router.get('/mushak-vat', (req, res) => {
  const { amount } = req.query;
  const total = Number(amount) || 0;
  const vat = total * 0.15;
  return res.json({ success: true, amount: total, vat, totalWithVat: total + vat });
});

// Police Report Create Route
router.post('/police-report/create', (req, res) => {
  const { title, details } = req.body;
  if (!title || !details) {
    return res.status(400).json({ success: false, message: 'Title and details required' });
  }
  return res.json({ success: true, message: 'Police report created', data: { title, details, status: 'pending' } });
});

// Police Report List Route
router.get('/police-report/list', (req, res) => {
  return res.json({ success: true, data: [] });
});

module.exports = router;