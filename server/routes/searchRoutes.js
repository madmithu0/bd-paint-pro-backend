const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const Material = require('../models/Material');

// Escape regex special characters to prevent ReDoS attacks
const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

// @route   GET /api/v1/search
// @desc    Safe Global Search, Filter, and Sort
// @access  Public / Protected
router.get('/', async (req, res, next) => {
  try {
    const { q = '', category = 'all', sortBy = 'newest', minPrice, maxPrice } = req.query;
    const safeQueryText = escapeRegex(String(q).trim().slice(0, 100));
    const searchRegex = new RegExp(safeQueryText, 'i');
    const sortOrder = sortBy === 'oldest' ? 1 : -1;

    const results = {};

    if (category === 'all' || category === 'jobs') {
      const jobQuery = { status: { $ne: 'Cancelled' } };
      if (safeQueryText) jobQuery.wallProblem = searchRegex;
      if (minPrice || maxPrice) {
        jobQuery.price = {};
        if (minPrice) jobQuery.price.$gte = Number(minPrice);
        if (maxPrice) jobQuery.price.$lte = Number(maxPrice);
      }
      results.jobs = await Job.find(jobQuery).sort({ createdAt: sortOrder }).limit(20).lean();
    }

    if (category === 'all' || category === 'mistri') {
      const userQuery = { role: 'Mistri', active: true, verify: true };
      if (safeQueryText) userQuery.name = searchRegex;
      results.mistris = await User.find(userQuery).select('name phone role verify').limit(20).lean();
    }

    if (category === 'all' || category === 'materials') {
      const matQuery = { status: 'Approved' };
      if (safeQueryText) matQuery.name = searchRegex;
      results.materials = await Material.find(matQuery).sort({ price: sortOrder }).limit(20).lean();
    }

    res.status(200).json({
      success: true,
      query: safeQueryText,
      category,
      results,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
