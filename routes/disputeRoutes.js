const express = require('express');
const router = express.Router();
const Dispute = require('../models/Dispute');
const Job = require('../models/Job');

router.post('/', async (req, res) => {
  try {
    const { jobId, reason } = req.body || {};
    if (!jobId || !reason?.trim()) return res.status(400).json({ success: false, message: 'jobId and reason required' });
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (String(job.customer) !== String(req.user._id) && String(job.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not your job' });
    }
    const open = await Dispute.findOne({ job: jobId, user: req.user._id, status: 'open' });
    if (open) return res.status(409).json({ success: false, message: 'Open dispute already exists' });
    const d = await Dispute.create({ job: jobId, user: req.user._id, reason: String(reason).trim().slice(0, 2000), status: 'open' });
    res.status(201).json({ success: true, data: d });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
    const list = await Dispute.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id/solve', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    if (!req.body?.solution?.trim()) return res.status(400).json({ success: false, message: 'Solution required' });
    const d = await Dispute.findById(req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Not found' });
    if (d.status !== 'open') return res.status(409).json({ success: false, message: 'Already solved' });
    d.status = 'solved';
    d.solution = String(req.body.solution).trim().slice(0, 2000);
    await d.save();
    res.json({ success: true, data: d });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;