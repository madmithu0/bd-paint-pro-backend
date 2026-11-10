const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');

router.post('/', async (req, res) => {
  try {
    const { jobId, lat, lng, photo } = req.body || {};
    if (!jobId) return res.status(400).json({ success: false, message: 'jobId required' });
    if (lat !== undefined && (Number(lat) < -90 || Number(lat) > 90)) return res.status(400).json({ success: false, message: 'Invalid lat' });
    if (lng !== undefined && (Number(lng) < -180 || Number(lng) > 180)) return res.status(400).json({ success: false, message: 'Invalid lng' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exists = await Attendance.findOne({ user: req.user._id, job: jobId, createdAt: { $gte: today } });
    if (exists) return res.status(409).json({ success: false, message: 'Already marked today' });
    const att = await Attendance.create({ user: req.user._id, job: jobId, lat: lat ?? null, lng: lng ?? null, photo: photo || '', status: 'pending' });
    res.status(201).json({ success: true, data: att });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const list = await Attendance.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/approve', async (req, res) => {
  try {
    if (!['approved', 'rejected'].includes(req.body?.status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const att = await Attendance.findById(req.params.id);
    if (!att) return res.status(404).json({ success: false, message: 'Not found' });
    att.status = req.body.status;
    await att.save();
    res.json({ success: true, data: att });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;