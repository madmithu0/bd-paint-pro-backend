const Payment = require('../models/Payment');
const Job = require('../models/Job');
const { distributeJobPayout } = require('../services/payment/splitPayout');
const { calculateMushakVat } = require('../utils/govtUtils');
const { broadcastChatAndContactUnlock, broadcastMilestoneUpdate } = require('../infra/socketEngine');

const createPayment = async (req, res, next) => {
  try {
    const {
      jobId,
      amount,
      paymentType = 'Advance30',
      milestoneStage = '30%',
      method,
      trxId,
    } = req.body;

    if (!jobId || !amount || !method || !trxId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID, amount, payment method, and TrxID are required.',
      });
    }

    const cleanTrxId = String(trxId).trim();
    const duplicate = await Payment.findOne({ trxId: cleanTrxId });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate Transaction ID blocked. This TrxID was already used.',
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const numericAmount = Number(amount);
    const stage1Expected = job.milestoneStages?.stage1Amount || Math.round(job.price * 0.30);

    if (paymentType === 'Full' && numericAmount !== job.price) {
      return res.status(400).json({
        success: false,
        message: `Exact amount mismatch! Expected BDT ${job.price}, received BDT ${numericAmount}.`,
      });
    }
    if ((paymentType === 'Advance30' || milestoneStage === '30%') && numericAmount !== stage1Expected) {
      return res.status(400).json({
        success: false,
        message: `Exact 30% advance mismatch! Expected BDT ${stage1Expected}, received BDT ${numericAmount}.`,
      });
    }

    const vatCalc = await calculateMushakVat(numericAmount);
    const ratio = job.price > 0 ? Math.min(1, numericAmount / job.price) : 1;
    const proportionalMaterial = Math.round((job.materialCost || 0) * ratio);
    const netProfitPortion = Math.max(0, numericAmount - proportionalMaterial - vatCalc.vatAmount);

    const hasAgent = Boolean(job.agent);
    const mistriShareAmount = Number((netProfitPortion * 0.80).toFixed(2));
    const agentShareAmount = hasAgent ? Number((netProfitPortion * 0.05).toFixed(2)) : 0;
    const platformShareAmount = hasAgent
      ? Number((netProfitPortion * 0.15).toFixed(2))
      : Number((netProfitPortion * 0.20).toFixed(2));

    const payment = await Payment.create({
      job: job._id,
      payer: req.user.id,
      amount: numericAmount,
      totalAmount: numericAmount,
      materialCost: proportionalMaterial,
      vatAmount: vatCalc.vatAmount,
      netProfit: netProfitPortion,
      milestoneStage: paymentType === 'Full' ? 'Full' : paymentType === 'AddOn30' ? 'AddOn30' : milestoneStage,
      paymentType,
      method,
      trxId: cleanTrxId,
      status: 'EscrowHeld',
      mistriShareAmount,
      agentShareAmount,
      platformShareAmount,
    });

    const is30Advance = ['Advance30', 'Full'].includes(paymentType) || milestoneStage === '30%';
    if (is30Advance) {
      job.milestone1Paid = true;
      job.milestoneStages.stage1Paid = true;
      job.milestoneStages.stage1PaidAt = new Date();
      if (paymentType === 'Full') {
        job.milestoneStages.stage2Paid = true;
        job.milestoneStages.stage3Paid = true;
      }
      await job.save();

      broadcastChatAndContactUnlock(job._id, job.customer, job.assignedMistri || []);
      broadcastMilestoneUpdate(job._id, { milestone1Paid: true, stage: payment.milestoneStage });
    }
    res.status(201).json({
      success: true,
      unlockedContactAndChat: is30Advance,
      message: is30Advance
        ? '30% Advance verified in Escrow. Mistri phone number and live chat are now unlocked.'
        : 'Payment recorded and held securely in Escrow.',
      payment,
    });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { paymentId, releaseEscrow = false, transactionPin, otpCode } = req.body;
    const payment = await Payment.findById(paymentId).populate('job');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    if (releaseEscrow && payment.job && payment.job.status !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Escrow payout cannot be released until the job status is Completed.',
      });
    }

    payment.status = releaseEscrow ? 'Released' : 'Verified';

    if (releaseEscrow && !payment.payoutDistributed) {
      const enforcePinGate = Boolean(transactionPin || process.env.SUPER_ADMIN_TRANSACTION_PIN);
      await distributeJobPayout(payment, {
        enforcePinGate,
        transactionPin: transactionPin || req.headers['x-transaction-pin'],
        otpCode,
        adminPhone: process.env.SUPER_ADMIN_PHONE,
        adminEmail: process.env.SUPER_ADMIN_GMAIL,
      });
      payment.payoutDistributed = true;
    }

    await payment.save();

    if (payment.job) {
      const job = await Job.findById(payment.job._id);
      if (job && !job.milestone1Paid) {
        job.milestone1Paid = true;
        job.milestoneStages.stage1Paid = true;
        job.milestoneStages.stage1PaidAt = new Date();
        await job.save();
        broadcastChatAndContactUnlock(job._id, job.customer, job.assignedMistri || []);
      }
    }

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

const getPaymentList = async (req, res, next) => {
  try {
    const filter = ['SuperAdmin', 'Admin'].includes(req.user.role) ? {} : { payer: req.user.id };
    const payments = await Payment.find(filter)
      .populate('job', 'sqft price status isMistriOnly milestone1Paid')
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
