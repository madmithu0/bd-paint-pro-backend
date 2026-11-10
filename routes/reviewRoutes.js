const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Job = require('../models/Job');

router.post('/', async (req, res) => {
  try {
    const { jobId, rating, text } = req.body || {};
    if (!jobId) return res.status(400).json({ success: false, message: 'jobId required' });
    if (!rating || Number(rating) < 1 || Number(rating) > 5) return res.status(400).json({ success: false, message: 'Rating 1-5 required' });
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (String(job.customer) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not your job' });
    if (job.status !== 'completed') return res.status(400).json({ success: false, message: 'Job not completed' });
    const exists = await Review.findOne({ job: jobId, user: req.user._id });
    if (exists) return res.status(409).json({ success: false, message: 'Already reviewed' });
    const review = await Review.create({ job: jobId, user: req.user._id, rating: Number(rating), text: String(text || '').slice(0, 1000) });
    res.status(201).json({ success: true, data: review });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/job/:jobId', async (req, res) => {
  try {
    const list = await Review.find({ job: req.params.jobId }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;