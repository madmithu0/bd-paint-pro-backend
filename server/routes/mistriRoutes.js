const express = require('express');
const router = express.Router();
const {
  getMistris,
  getMistri,
  createMistri,
  updateMistri,
  deleteMistri,
  getAvailableMistris
} = require('../controllers/mistriController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/available/list', getAvailableMistris);
router.get('/', getMistris);
router.get('/:id', getMistri);
router.post('/', authorize('admin', 'manager'), createMistri);
router.put('/:id', authorize('admin', 'manager'), updateMistri);
router.delete('/:id', authorize('admin'), deleteMistri);

module.exports = router;