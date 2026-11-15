const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { paymentRateLimiter } = require('../middleware/rateLimitMiddleware');

// @route   POST /api/v1/payments/create
// @desc    Initiate Bkash / Nagad / Advance (30% or 50%) Job Payment
// @access  Protected (Rate Limited)
router.post('/create', paymentRateLimiter, paymentController.createPayment);

// @route   POST /api/v1/payments/verify
// @desc    Verify Payment TrxID & Exact Amount Match (Escrow Hold + Auto Share Split)
// @access  Protected (Rate Limited)
router.post('/verify', paymentRateLimiter, paymentController.verifyPayment);

// @route   GET /api/v1/payments
// @desc    Get Payment History List for Logged-in User
// @access  Protected
router.get('/', paymentController.getPaymentList);

// @route   GET /api/v1/payments/:id
// @desc    Get Single Payment & Share Breakup Details (Mistri 80%, Agent 5%, Platform 15%/20%)
// @access  Protected
router.get('/:id', paymentController.getPaymentDetails);

module.exports = router;
