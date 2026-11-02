const express = require('express');
const router = express.Router();
const {
  getJobs,
  getJob,
  createJob,
  updateJob,
  assignMistri,
  updateJobStatus
} = require('../controllers/jobController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/', getJobs);
router.get('/:id', getJob);
router.post('/', authorize('admin', 'manager', 'staff'), createJob);
router.put('/:id', authorize('admin', 'manager', 'staff'), updateJob);
router.put('/:id/assign', authorize('admin', 'manager'), assignMistri);
router.put('/:id/status', updateJobStatus);

module.exports = router;