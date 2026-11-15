const Payment = require('../../models/Payment');
const Job = require('../../models/Job');

const verifyAndLockEscrow = async ({ jobId, trxId, paidAmount, method, payerId }) => {
  const cleanTrxId = String(trxId || '').trim();
  if (!cleanTrxId) {
    throw new Error('Transaction ID (TrxID) is required.');
  }

  // 1. Duplicate TrxID Fraud Block
  const duplicate = await Payment.findOne({ trxId: cleanTrxId });
  if (duplicate) {
    return {
      verified: false,
      reason: 'DUPLICATE_TRX_ID_BLOCKED',
      message: 'This Transaction ID has already been used.',
    };
  }

  // 2. Job & Exact Amount Match Check (Reject even 1 Taka less/more)
  const job = await Job.findById(jobId);
  if (!job) {
    return { verified: false, reason: 'JOB_NOT_FOUND', message: 'Associated job not found.' };
  }

  const numericPaid = Number(paidAmount);
  if (numericPaid !== job.price) {
    return {
      verified: false,
      reason: 'EXACT_AMOUNT_MISMATCH',
      message: `Amount mismatch: Expected exactly BDT ${job.price}, but received BDT ${numericPaid}.`,
    };
  }

  // 3. Escrow Lock: Hold funds until job status becomes 'Completed'
  const hasAgent = Boolean(job.agent);
  const payment = await Payment.create({
    job: job._id,
    payer: payerId,
    amount: numericPaid,
    method,
    trxId: cleanTrxId,
    status: 'EscrowHeld',
    mistriShareAmount: Number((numericPaid * 0.80).toFixed(2)),
    agentShareAmount: hasAgent ? Number((numericPaid * 0.05).toFixed(2)) : 0,
    platformShareAmount: hasAgent
      ? Number((numericPaid * 0.15).toFixed(2))
      : Number((numericPaid * 0.20).toFixed(2)),
  });

  return {
    verified: true,
    status: 'EscrowHeld',
    message: 'Payment verified and locked in Escrow until job completion.',
    payment,
  };
};

// Check if Escrow can be released (Only when Job is Completed)
const canReleaseEscrow = async (jobId) => {
  const job = await Job.findById(jobId).lean();
  if (!job || job.status !== 'Completed') {
    return { allowed: false, reason: 'Escrow cannot be released before job completion.' };
  }
  return { allowed: true };
};

module.exports = {
  verifyAndLockEscrow,
  canReleaseEscrow,
};
