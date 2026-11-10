const express = require('express');
const router = express.Router();
const job = require('../controllers/jobController');

function validateJob(req, res, next) {
  const { sqft, price } = req.body || {};
  if (!sqft || Number(sqft) <= 0) return res.status(400).json({ success: false, message: 'Valid sqft required' });
  if (price !== undefined && Number(price) < 0) return res.status(400).json({ success: false, message: 'Invalid price' });
  next();
}

function validateStatus(req, res, next) {
  const allowed = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ success: false, message: 'Invalid status' });
  next();
}

router.post('/', validateJob, job.create);
router.get('/', job.list);
router.get('/:id', job.details);
router.patch('/:id/assign', (req, res, next) => {
  if (!req.body?.mistriId) return res.status(400).json({ success: false, message: 'mistriId required' });
  next();
}, job.assign);
router.patch('/:id/status', validateStatus, job.updateStatus);

module.exports = router;