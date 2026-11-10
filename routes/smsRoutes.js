const express = require('express');
const router = express.Router();

// SMS Create Route
router.post('/create', (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) {
    return res.status(400).json({ success: false, message: 'To and text required' });
  }
  return res.json({ success: true, message: 'SMS sent', data: { to, text } });
});

// SMS List Route
router.get('/list', (req, res) => {
  return res.json({ success: true, data: [] });
});

// SMS Details Route
router.get('/details/:id', (req, res) => {
  return res.json({ success: true, id: req.params.id, data: {} });
});

// SMS Delete Route
router.delete('/delete/:id', (req, res) => {
  return res.json({ success: true, message: 'SMS deleted', id: req.params.id });
});

// SMS Template Create Route
router.post('/template/create', (req, res) => {
  const { name, text } = req.body;
  if (!name || !text) {
    return res.status(400).json({ success: false, message: 'Template name and text required' });
  }
  return res.json({ success: true, message: 'SMS template created', data: { name, text } });
});

// SMS Template List Route
router.get('/template/list', (req, res) => {
  return res.json({ success: true, data: [] });
});

module.exports = router;