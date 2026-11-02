const express = require('express');
const router = express.Router();
const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  getCategories
} = require('../controllers/serviceController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Public
router.get('/', getServices);
router.get('/categories/list', getCategories);
router.get('/:id', getService);

// Protected - Admin/Manager only
router.post('/', protect, authorize('admin', 'manager'), upload.single('image'), createService);
router.put('/:id', protect, authorize('admin', 'manager'), upload.single('image'), updateService);
router.delete('/:id', protect, authorize('admin'), deleteService);

module.exports = router;