const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Job = require('../models/Job');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, async (req, res) => {
  try {
    const { jobId, rating, text } = req.body || {};
    const userId = req.user._id || req.user.id;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'jobId required' });
    }
    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, message: 'Rating 1-5 required' });
    }
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    if (String(job.customer) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Not your job' });
    }
    if (job.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Job not completed' });
    }
    const exists = await Review.findOne({ job: jobId, user: userId });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Already reviewed' });
    }
    const review = await Review.create({
      job: jobId,
      user: userId,
      rating: Number(rating),
      text: String(text || '').slice(0, 1000)
    });
    return res.status(201).json({ success: true, data: review });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/create', protect, async (req, res) => {
  try {
    const { targetId, targetType, rating, comment, text } = req.body || {};
    if (!targetId || !rating) {
      return res.status(400).json({ success: false, message: 'Target and rating required' });
    }
    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }
    const review = await Review.create({
      user: req.user._id || req.user.id,
      target: targetId,
      targetType: targetType || 'property',
      rating: Number(rating),
      comment: comment || '',
      text: String(text || comment || '').slice(0, 1000)
    });
    return res.status(201).json({ success: true, message: 'Review created', data: review });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/worker/:workerId', async (req, res) => {
  try {
    const jobs = await Job.find({ worker: req.params.workerId }).select('_id');
    const jobIds = jobs.map((j) => j._id);
    const reviews = await Review.find({ job: { $in: jobIds } }).sort({ createdAt: -1 }).limit(50).populate('user', 'name avatar');
    return res.json({ success: true, data: reviews });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/job/:jobId', async (req, res) => {
  try {
    const list = await Review.find({ job: req.params.jobId }).sort({ createdAt: -1 }).limit(50).populate('user', 'name avatar');
    return res.json({ success: true, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/list/:targetId', async (req, res) => {
  try {
    const reviews = await Review.find({ target: req.params.targetId }).sort({ createdAt: -1 }).populate('user', 'name avatar');
    return res.json({ success: true, data: reviews });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const reviews = await Review.find({ user: userId }).sort({ createdAt: -1 });
    return res.json({ success: true, data: reviews });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    return res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;