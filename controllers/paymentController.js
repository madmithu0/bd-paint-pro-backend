const Payment = require('../models/Payment');
const Job = require('../models/Job');
const { success, error } = require('../utils/response');

const createPayment = async (req, res) => {
  try {
    const { jobId, amount, method } = req.body;

    if (!jobId || !amount || !method) {
      return error(res, 'jobId, amount and method are required', 400);
    }

    const job = await Job.findById(jobId);
    if (!job) return error(res, 'Job not found', 404);

    if (String(job.customer) !== String(req.user.id) && req.user.role !== 'admin') {
      return error(res, 'Not your job', 403);
    }

    if (Number(amount) !== Number(job.price)) {
      return error(res, 'Amount must match job price', 400);
    }

    const payment = await Payment.create({
      job: jobId,
      customer: req.user.id,
      user: req.user.id,
      amount: Number(amount),
      method,
      status: 'pending',
      escrow: true
    });

    return success(res, 'Payment created', payment, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getMyPayments = async (req, res) => {
  try {
    const list = await Payment.find({
      $or: [{ user: req.user.id }, { customer: req.user.id }]
    }).sort({ createdAt: -1 }).limit(100);

    return success(res, 'Payments found', list);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return error(res, 'Not found', 404);

    const ownerId = payment.user || payment.customer;
    if (String(ownerId) !== String(req.user.id) && req.user.role !== 'admin') {
      return error(res, 'Forbidden', 403);
    }

    return success(res, 'Payment found', payment);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { trxId, amount } = req.body;

    if (!trxId) return error(res, 'trxId is required', 400);

    const payment = await Payment.findById(req.params.id);
    if (!payment) return error(res, 'Not found', 404);
    if (payment.status === 'paid') return error(res, 'Already verified', 409);

    const cleanTrxId = String(trxId).trim();

    const dup = await Payment.findOne({ trxId: cleanTrxId, status: 'paid' });
    if (dup) return error(res, 'Duplicate trxId', 409);

    if (amount !== undefined && Number(amount) !== Number(payment.amount)) {
      return error(res, 'Amount mismatch', 400);
    }

    payment.trxId = cleanTrxId;
    payment.status = 'paid';
    payment.escrow = true;
    await payment.save();

    return success(res, 'Payment verified', payment);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Duplicate trxId', 409);
    return error(res, err.message, 500);
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    if (!req.body.status) return error(res, 'status is required', 400);

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!payment) return error(res, 'Not found', 404);
    return success(res, 'Payment updated', payment);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = {
  create: createPayment,
  list: getMyPayments,
  details: getPaymentById,
  verify: verifyPayment,
  createPayment,
  getMyPayments,
  getPaymentById,
  verifyPayment,
  updatePaymentStatus
};