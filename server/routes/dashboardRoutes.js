const express = require('express');
const router = express.Router();
const {
  getOverview,
  getRecentJobs,
  getRevenueChart,
  getTopServices,
  getTopMistris
} = require('../controllers/dashboardController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/overview', getOverview);
router.get('/recent-jobs', getRecentJobs);
router.get('/revenue-chart', getRevenueChart);
router.get('/top-services', getTopServices);
router.get('/top-mistris', getTopMistris);

module.exports = router;