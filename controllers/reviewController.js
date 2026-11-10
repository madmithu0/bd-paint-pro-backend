const Review = require('../models/Review');
const { success, error } = require('../utils/response');

const createReview = async (req, res) => {
  try {
    const review = await Review.create({ ...req.body, customer: req.user.id });
    return success(res, 'Review added', review, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getWorkerReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ worker: req.params.workerId }).populate('customer', 'name profilePic');
    return success(res, 'Reviews found', reviews);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { createReview, getWorkerReviews };