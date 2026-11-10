const express = require('express');
const router = express.Router();
const job = require('../controllers/jobController');
const { protect } = require('../middleware/authMiddleware');

const createHandler = job.create || job.createJob;
const listHandler = job.list || job.getJobs;
const detailsHandler = job.details || job.getJobById;
const assignHandler = job.assign;
const statusHandler = job.updateStatus || job.updateJobStatus;
const deleteHandler = job.deleteJob || job.delete;

function validateJob(req, res, next) {
  const { sqft, price } = req.body || {};
  if (!sqft || Number(sqft) <= 0) {
    return res.status(400).json({ success: false, message: 'Valid sqft required' });
  }
  if (price !== undefined && Number(price) < 0) {
    return res.status(400).json({ success: false, message: 'Invalid price' });
  }
  next();
}

function validateStatus(req, res, next) {
  const allowed = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
  if (!allowed.includes(req.body?.status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  next();
}

router.post('/', protect, validateJob, createHandler);
router.get('/', listHandler);
router.get('/:id', detailsHandler);

router.patch('/:id/assign', protect, (req, res, next) => {
  if (!req.body?.mistriId) {
    return res.status(400).json({ success: false, message: 'mistriId required' });
  }
  next();
}, assignHandler);

router.patch('/:id/status', protect, validateStatus, statusHandler);
router.delete('/:id', protect, deleteHandler);

module.exports = router;