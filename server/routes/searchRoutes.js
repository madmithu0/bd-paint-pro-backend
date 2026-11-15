const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const Material = require('../models/Material');

// @route   GET /api/v1/search
// @desc    Global Search, Filter, and Sort across Jobs, Mistris, and Materials
// @access  Protected
router.get('/', async (req, res, next) => {
  try {
    const { q = '', category = 'all', sortBy = 'newest', minPrice, maxPrice } = req.query;
    const searchRegex = new RegExp(q.trim(), 'i');
    const sortOrder = sortBy === 'oldest' ? 1 : -1;

    const results = {};

    if (category === 'all' || category === 'jobs') {
      const jobQuery = {};
      if (q) jobQuery.wallProblem = searchRegex;
      if (minPrice || maxPrice) {
        jobQuery.price = {};
        if (minPrice) jobQuery.price.$gte = Number(minPrice);
        if (maxPrice) jobQuery.price.$lte = Number(maxPrice);
      }
      results.jobs = await Job.find(jobQuery).sort({ createdAt: sortOrder }).limit(20).lean();
    }

    if (category === 'all' || category === 'mistri') {
      const userQuery = { role: 'Mistri', active: true };
      if (q) userQuery.name = searchRegex;
      results.mistris = await User.find(userQuery).select('name phone role verify').limit(20).lean();
    }

    if (category === 'all' || category === 'materials') {
      const matQuery = { approved: true };
      if (q) matQuery.name = searchRegex;
      results.materials = await Material.find(matQuery).sort({ price: sortOrder }).limit(20).lean();
    }

    res.status(200).json({
      success: true,
      query: q,
      category,
      results,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
