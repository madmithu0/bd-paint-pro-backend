const express = require('express');
const router = express.Router();
const payment = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

const createHandler = payment.create || payment.createPayment;
const listHandler = payment.list || payment.getMyPayments;
const detailsHandler = payment.details;
const verifyHandler = payment.verify || payment.verifyPayment;

function validatePayment(req, res, next) {
  const { jobId, amount, method } = req.body || {};
  if (!jobId) {
    return res.status(400).json({ success: false, message: 'jobId required' });
  }
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Valid amount required' });
  }
  if (!['bkash', 'nagad', 'rocket', 'bank'].includes(method)) {
    return res.status(400).json({ success: false, message: 'Invalid method' });
  }
  next();
}

router.post('/', protect, validatePayment, createHandler);
router.get('/', protect, listHandler);
router.get('/my', protect, listHandler);
router.get('/:id', protect, detailsHandler);

router.post('/:id/verify', protect, (req, res, next) => {
  if (!req.body?.trxId) {
    return res.status(400).json({ success: false, message: 'trxId required' });
  }
  next();
}, verifyHandler);

router.post('/verify', protect, verifyHandler);

module.exports = router;