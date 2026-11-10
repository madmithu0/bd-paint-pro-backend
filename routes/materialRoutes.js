const express = require('express');
const router = express.Router();

// Material Create Route
router.post('/create', (req, res) => {
  const { name, price, stock } = req.body;
  if (!name || !price) {
    return res.status(400).json({ success: false, message: 'Name and price required' });
  }
  return res.json({ success: true, message: 'Material created', data: { name, price, stock: stock || 0 } });
});

// Material List Route
router.get('/list', (req, res) => {
  return res.json({ success: true, data: [] });
});

// Material Details Route
router.get('/details/:id', (req, res) => {
  return res.json({ success: true, id: req.params.id, data: {} });
});

// Material Edit Route
router.put('/edit/:id', (req, res) => {
  return res.json({ success: true, message: 'Material updated', id: req.params.id, data: req.body });
});

// Material Delete Route
router.delete('/delete/:id', (req, res) => {
  return res.json({ success: true, message: 'Material deleted', id: req.params.id });
});

// Material Approve Route
router.put('/approve/:id', (req, res) => {
  return res.json({ success: true, message: 'Material approved', id: req.params.id });
});

// Material Reject Route
router.put('/reject/:id', (req, res) => {
  return res.json({ success: true, message: 'Material rejected', id: req.params.id });
});

module.exports = router;