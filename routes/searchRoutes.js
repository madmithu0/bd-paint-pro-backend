const express = require('express');
const router = express.Router();

// Global Search Route
router.get('/', (req, res) => {
  const { q } = req.query;
  return res.json({ success: true, message: 'Search result', query: q || '', data: [] });
});

// Search Filter Route
router.get('/filter', (req, res) => {
  const { type, status } = req.query;
  return res.json({ success: true, message: 'Filtered search', filter: { type, status }, data: [] });
});

// Search Sort Route
router.get('/sort', (req, res) => {
  const { sortBy } = req.query;
  return res.json({ success: true, message: 'Sorted search', sortBy: sortBy || 'newest', data: [] });
});

module.exports = router;