const express = require('express');
const router = express.Router();
const payment = require('../controllers/paymentController');

function validatePayment(req, res, next) {
  const { jobId, amount, method } = req.body || {};
  if (!jobId) return res.status(400).json({ success: false, message: 'jobId required' });
  if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
  if (!['bkash', 'nagad', 'rocket', 'bank'].includes(method)) return res.status(400).json({ success: false, message: 'Invalid method' });
  next();
}

router.post('/', validatePayment, payment.create);
router.get('/', payment.list);
router.get('/:id', payment.details);
router.post('/:id/verify', (req, res, next) => {
  if (!req.body?.trxId) return res.status(400).json({ success: false, message: 'trxId required' });
  next();
}, payment.verify);

module.exports = router;