const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/create', protect, async (req, res) => {
  try {
    const { targetId, targetType, reason, description } = req.body || {};
    if (!targetId || !reason) {
      return res.status(400).json({ success: false, message: 'Target and reason required' });
    }
    const report = await Report.create({
      user: req.user._id || req.user.id,
      target: targetId,
      targetType: targetType || 'property',
      reason: String(reason).slice(0, 200),
      description: String(description || '').slice(0, 1000),
      status: 'pending'
    });
    return res.status(201).json({ success: true, message: 'Report created', data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const reports = await Report.find({ user: userId }).sort({ createdAt: -1 });
    return res.json({ success: true, data: reports });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/all', protect, admin, async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).populate('user', 'name email');
    return res.json({ success: true, data: reports });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/job', protect, admin, async (req, res) => {
  try {
    const Job = require('../models/Job');
    const total = await Job.countDocuments();
    const completed = await Job.countDocuments({ status: 'completed' });
    const pending = await Job.countDocuments({ status: 'pending' });
    const cancelled = await Job.countDocuments({ status: 'cancelled' });
    return res.json({ success: true, message: 'Job report', data: { total, completed, pending, cancelled } });
  } catch (err) {
    return res.json({ success: true, message: 'Job report', data: { total: 0, completed: 0, pending: 0, cancelled: 0 } });
  }
});

router.get('/payment', protect, admin, async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const totalCount = await Payment.countDocuments();
    const paid = await Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const pending = await Payment.countDocuments({ status: 'pending' });
    return res.json({ success: true, message: 'Payment report', data