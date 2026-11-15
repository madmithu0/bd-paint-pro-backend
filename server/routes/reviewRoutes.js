const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { requireRole } = require('../middleware/authMiddleware');

// @route   POST /api/v1/reviews
// @desc    Create a Job Rating & Review
// @access  Protected (Customer)
router.post('/', requireRole(['Customer']), async (req, res, next) => {
  try {
    const { jobId, mistriId, rating, text } = req.body;

    if (!jobId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Valid Job ID and rating (1 to 5) are required.',
      });
    }

    const existingReview = await Review.findOne({ job: jobId, reviewer: req.user.id });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a review for this job.',
      });
    }

    const review = await Review.create({
      job: jobId,
      reviewer: req.user.id,
      mistri: mistriId || null,
      rating: Number(rating),
      text: text || '',
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully.',
      review,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/reviews
// @desc    Get Review List (By Job ID or Mistri ID)
// @access  Protected
router.get('/', async (req, res, next) => {
  try {
    const { jobId, mistriId } = req.query;
    const filter = {};
    if (jobId) filter.job = jobId;
    if (mistriId) filter.mistri = mistriId;

    const reviews = await Review.find(filter)
      .populate('reviewer', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
