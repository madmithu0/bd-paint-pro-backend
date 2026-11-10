const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { protect, admin } = require('../middleware/authMiddleware');

function buildReportFilter(query) {
  const filter = {};
  if (query.targetType) filter.targetType = query.targetType;
  if (query.status) filter.status = query.status;
  if (query.targetId) filter.target = query.targetId;
  if (query.user) filter.user = query.user;
  return filter;
}

async function getReports(filter) {
  return Report.find(filter).sort({ createdAt: -1 }).populate('user', 'name email');
}

async function getSummary(filter) {
  const [total, pending, reviewed, resolved, rejected] = await Promise.all([
    Report.countDocuments(filter),
    Report.countDocuments({ ...filter, status: 'pending' }),
    Report.countDocuments({ ...filter, status: 'reviewed' }),
    Report.countDocuments({ ...filter, status: 'resolved' }),
    Report.countDocuments({ ...filter, status: 'rejected' })
  ]);
  return { total, pending, reviewed, resolved, rejected };
}

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
    const reports = await getReports({ user: userId });
    return res.json({ success: true, data: reports });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/all', protect, admin, async (req, res) => {
  try {
    const filter = buildReportFilter(req.query);
    const [reports, summary] = await Promise.all([getReports(filter), getSummary(filter)]);
    return res.json({ success: true, data: reports, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/job', protect, admin, async (req, res) => {
  try {
    const filter = { ...buildReportFilter(req.query), targetType: 'job' };
    const [reports, summary] = await Promise.all([getReports(filter), getSummary(filter)]);
    return res.json({ success: true, message: 'Job report', data: reports, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/payment', protect, admin, async (req, res) => {
  try {
    const filter = { ...buildReportFilter(req.query), targetType: 'payment' };
    const [reports, summary] = await Promise.all([getReports(filter), getSummary(filter)]);
    return res.json({ success: true, message: 'Payment report', data: reports, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/export', protect, admin, async (req, res) => {
  try {
    const filter = buildReportFilter(req.query);
    const reports = await Report.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ success: true, message: 'Report export ready', data: reports });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/status', protect, admin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['pending', 'reviewed', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    return res.json({ success: true, message: 'Report updated', data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;