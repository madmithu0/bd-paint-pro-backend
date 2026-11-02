const express = require('express');
const router = express.Router();
const {
  getBanners,
  getActiveBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner
} = require('../controllers/bannerController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Public - for client website
router.get('/active/list', getActiveBanners);

// Protected
router.get('/', protect, getBanners);
router.get('/:id', protect, getBanner);
router.post('/', protect, authorize('admin', 'manager'), upload.single('image'), createBanner);
router.put('/:id', protect, authorize('admin', 'manager'), upload.single('image'), updateBanner);
router.delete('/:id', protect, authorize('admin'), deleteBanner);

module.exports = router;