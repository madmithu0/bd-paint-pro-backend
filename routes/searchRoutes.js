const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const User = require('../models/User');

function buildFilter(query) {
  const filter = {};
  const q = String(query.q || '').trim();
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { address: { $regex: q, $options: 'i' } },
      { city: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } }
    ];
  }
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.city) filter.city = { $regex: String(query.city), $options: 'i' };
  const minPrice = Number(query.minPrice) || 0;
  const maxPrice = Number(query.maxPrice) || 0;
  if (minPrice > 0 || maxPrice > 0) {
    filter.price = {};
    if (minPrice > 0) filter.price.$gte = minPrice;
    if (maxPrice > 0) filter.price.$lte = maxPrice;
  }
  return filter;
}

function buildSort(sortBy) {
  if (sortBy === 'price-low') return { price: 1 };
  if (sortBy === 'price-high') return { price: -1 };
  if (sortBy === 'oldest') return { createdAt: 1 };
  if (sortBy === 'name') return { title: 1 };
  return { createdAt: -1 };
}

async function runSearch(query) {
  const filter = buildFilter(query);
  const sort = buildSort(query.sortBy || 'newest');
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const [properties, total] = await Promise.all([
    Property.find(filter).sort(sort).skip(skip).limit(limit),
    Property.countDocuments(filter)
  ]);
  return { properties, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

router.get('/', async (req, res) => {
  try {
    const result = await runSearch(req.query);
    return res.json({ success: true, message: 'Search result', query: req.query.q || '', data: result.properties, pagination: result.pagination });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/filter', async (req, res) => {
  try {
    const result = await runSearch(req.query);
    return res.json({ success: true, message: 'Filtered search', filter: { type: req.query.type, status: req.query.status, city: req.query.city, minPrice: req.query.minPrice, maxPrice: req.query.maxPrice }, data: result.properties, pagination: result.pagination });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/sort', async (req, res) => {
  try {
    const result = await runSearch(req.query);
    return res.json({ success: true, message: 'Sorted search', sortBy: req.query.sortBy || 'newest', data: result.properties, pagination: result.pagination });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ success: true, data: [] });
    }
    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ]
    }).select('name email phone avatar role').limit(20);
    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;