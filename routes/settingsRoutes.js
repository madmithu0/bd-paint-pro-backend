const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/public', async (req, res) => {
  try {
    const settings = await Setting.findOne().lean();
    return res.json({ success: true, data: settings || { appName: 'App', currency: 'BDT', maintenance: false } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/all', protect, admin, async (req, res) => {
  try {
    const settings = await Setting.findOne().lean();
    return res.json({ success: true, data: settings || {} });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/update', protect, admin, async (req, res) => {
  try {
    const payload = req.body || {};
    delete payload._id;
    delete payload.__v;
    const settings = await Setting.findOneAndUpdate({}, { $set: payload }, { new: true, upsert: true });
    return res.json({ success: true, message: 'Settings updated', data: settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/maintenance', protect, admin, async (req, res) => {
  try {
    const { maintenance } = req.body || {};
    const settings = await Setting.findOneAndUpdate({}, { $set: { maintenance: Boolean(maintenance) } }, { new: true, upsert: true });
    return res.json({ success: true, message: 'Maintenance updated', data: settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;