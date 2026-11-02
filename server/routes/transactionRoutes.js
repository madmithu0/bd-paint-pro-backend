const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getFinancialSummary
} = require('../controllers/transactionController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/summary/financial', authorize('admin', 'manager'), getFinancialSummary);
router.get('/', getTransactions);
router.get('/:id', getTransaction);
router.post('/', authorize('admin', 'manager', 'staff'), createTransaction);
router.put('/:id', authorize('admin', 'manager'), updateTransaction);
router.delete('/:id', authorize('admin'), deleteTransaction);

module.exports = router;