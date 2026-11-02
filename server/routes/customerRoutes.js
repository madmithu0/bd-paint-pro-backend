const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerJobs
} = require('../controllers/customerController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.get('/:id/jobs', getCustomerJobs);
router.put('/:id', authorize('admin', 'manager'), updateCustomer);
router.delete('/:id', authorize('admin'), deleteCustomer);

module.exports = router;