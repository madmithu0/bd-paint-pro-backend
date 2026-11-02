const express = require('express');
const router = express.Router();
const {
  getMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  updateStock,
  getLowStock
} = require('../controllers/materialController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.use(protect);

router.get('/low-stock/list', getLowStock);
router.get('/', getMaterials);
router.get('/:id', getMaterial);
router.post('/', authorize('admin', 'manager'), upload.single('image'), createMaterial);
router.put('/:id', authorize('admin', 'manager'), upload.single('image'), updateMaterial);
router.put('/:id/stock', authorize('admin', 'manager', 'staff'), updateStock);
router.delete('/:id', authorize('admin'), deleteMaterial);

module.exports = router;