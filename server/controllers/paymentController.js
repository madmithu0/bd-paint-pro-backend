const Payment = require('../models/Payment');
const Job = require('../models/Job');
const { distributeJobPayout } = require('../services/payment/splitPayout');

// 1. Create / Initiate Payment Record
const createPayment = async (req, res, next) => {
  try {
    const { jobId, amount, paymentType = 'Full', method, trxId } = req.body;

    if (!jobId || !amount || !method || !trxId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID, amount, payment method, and TrxID are required.',
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    // Strict Amount Validation (Reject even 1 Taka mismatch for Full payment)
    const numericAmount = Number(amount);
    if (paymentType === 'Full' && numericAmount !== job.price) {
      return res.status(400).json({
        success: false,
        message: `Exact amount mismatch! Expected BDT ${job.price}, received BDT ${numericAmount}.`,
      });
    }

    // Calculate Auto Share Split
    const hasAgent = Boolean(job.agent);
    const mistriShareAmount = Number((numericAmount * 0.80).toFixed(2));
    const agentShareAmount = hasAgent ? Number((numericAmount * 0.05).toFixed(2)) : 0;
    const platformShareAmount = hasAgent
      ? Number((numericAmount * 0.15).toFixed(2))
      : Number((numericAmount * 0.20).toFixed(2));

    const payment = await Payment.create({
      job: job._id,
      payer: req.user.id,
      amount: numericAmount,
      paymentType,
      method,
      trxId: String(trxId).trim(),
      status: 'EscrowHeld', // Held securely in Escrow until job completion
      mistriShareAmount,
      agentShareAmount,
      platformShareAmount,
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded and held securely in Escrow.',
      payment,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Verify Payment & Release Escrow Split Payout when Job Completed
const verifyPayment = async (req, res, next) => {
  try {
    const { paymentId, releaseEscrow = false } = req.body;
    const payment = await Payment.findById(paymentId).populate('job');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    payment.status = releaseEscrow ? 'Released' : 'Verified';

    // Distribute Equal Split to Mistris & Agent if Escrow is released
    if (releaseEscrow && !payment.payoutDistributed) {
      await distributeJobPayout(payment);
      payment.payoutDistributed = true;
    }

    await payment.save();

    res.status(200).json({
      success: true,
      message: releaseEscrow
        ? 'Payment verified and shares credited equally to Mistri/Agent wallets.'
        : 'Payment TrxID verified successfully.',
      payment,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Payment List
const getPaymentList = async (req, res, next) => {
  try {
    const filter = req.user.role === 'SuperAdmin' ? {} : { payer: req.user.id };
    const payments = await Payment.find(filter)
      .populate('job', 'sqft price status isMistriOnly')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Get Single Payment Details
const getPaymentDetails = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('job')
      .populate('payer', 'name phone')
      .lean();

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    res.status(200).json({
      success: true,
      payment,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPayment,
  verifyPayment,
  getPaymentList,
  getPaymentDetails,
};
