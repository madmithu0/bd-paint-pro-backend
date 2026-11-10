const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Job = require('../models/Job');
const { protect } = require('../middleware/authMiddleware');

function buildReviewFilter(query) {
  const filter = {};
  if (query.job) filter.job = query.job;
  if (query.target) filter.target = query.target;
  if (query.targetType) filter.targetType = query.targetType;
  if (query.user) filter.user = query.user;
  return filter;
}

function buildSort(sortBy) {
  if (sortBy === 'rating-high') return { rating: -1 };
  if (sortBy === 'rating-low') return { rating: 1 };
  if (sortBy === 'oldest') return { createdAt: 1 };
  return { createdAt: -1 };
}

async function getReviews(filter, query) {
  const sort = buildSort(query.sortBy || 'newest');
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 50));
  return Review.find(filter).sort(sort).limit(limit).populate('user', 'name avatar');
}

async function createReview({ userId, jobId, targetId, targetType, rating, text, comment }) {
  const ratingNum = Number(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    throw { status: 400, message: 'Rating 1-5 required' };
  }
  const cleanText = String(text || comment || '').slice(0, 1000);

  if (jobId) {
    const job = await Job.findById(jobId);
    if (!job) throw { status: 404, message: 'Job not found' };
    if (String(job.customer) !== String(userId)) throw { status: 403, message: 'Not your job' };
    if (job.status !== 'completed') throw { status: 400, message: 'Job not completed' };
    const exists = await Review.findOne({ job: jobId, user: userId });
    if (exists) throw { status: 409, message: 'Already reviewed' };
    return Review.create({
      job: jobId,
      user: userId,
      target: jobId,
      targetType: 'job',
      rating: ratingNum,
      text: cleanText,
      comment: cleanText
    });
  }

  if (!targetId) throw { status: 400, message: 'jobId or targetId required' };
  const exists = await Review.findOne({ target: targetId, user: userId });
  if (exists) throw { status: 409, message: 'Already reviewed' };
  return Review.create({
    user: userId,
    target: targetId,
    targetType: targetType || 'property',
    rating: ratingNum,
    text: cleanText,
    comment: cleanText
  });
}

function handleCreateError(err, res) {
  if (err && err.status) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  return res.status(500).json({ success: false, message: 'Server error' });
}

router.post('/', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const review = await createReview({ userId, ...req.body });
    return res.status(201).json({ success: true, data: review });
  } catch (err) {
    return handleCreateError(err, res);
  }
});

router.post('/create', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const review = await createReview({ userId, ...req.body });
    return res.status(201).json({ success: true, message: 'Review created', data: review });
  } catch (err) {
    return handleCreateError(err, res);
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
    const reviews = await getReviews({ job: req.params.jobId }, req.query);
    return res.json({ success: true, data: reviews });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/list/:targetId', async (req, res) => {
  try {
    const reviews = await getReviews({ target: req.params.targetId }, req.query);
    return res.json({ success: true, data: reviews });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const reviews = await getReviews({ user: userId }, req.query);
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