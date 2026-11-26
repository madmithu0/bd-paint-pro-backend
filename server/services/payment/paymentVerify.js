const Payment = require('../../models/Payment');
const Job = require('../../models/Job');

const verifyAndLockEscrow = async ({
  jobId,
  trxId,
  paidAmount,
  method,
  payerId,
  milestoneStage = '30%',
  vatAmount = 0,
}) => {
  const cleanTrxId = String(trxId || '').trim();
  if (!cleanTrxId) {
    throw new Error('Transaction ID (TrxID) is required.');
  }

  const duplicate = await Payment.findOne({ trxId: cleanTrxId });
  if (duplicate) {
    return {
      verified: false,
      reason: 'DUPLICATE_TRX_ID_BLOCKED',
      message: 'This Transaction ID has already been used.',
    };
  }

  const job = await Job.findById(jobId);
  if (!job) {
    return { verified: false, reason: 'JOB_NOT_FOUND', message: 'Associated job not found.' };
  }

  let expectedAmount = job.price;
  if (milestoneStage === '30%') expectedAmount = job.milestoneStages?.stage1Amount || Math.round(job.price * 0.30);
  else if (milestoneStage === '40%') expectedAmount = job.milestoneStages?.stage2Amount || Math.round(job.price * 0.40);
  else if (milestoneStage === '30%_FINAL') expectedAmount = job.milestoneStages?.stage3Amount || Math.max(0, job.price - Math.round(job.price * 0.30) - Math.round(job.price * 0.40));

  const numericPaid = Number(paidAmount);
  if (milestoneStage !== 'AddOn30' && numericPaid !== expectedAmount) {
    return {
      verified: false,
      reason: 'EXACT_AMOUNT_MISMATCH',
      message: `Amount mismatch: Expected exactly BDT ${expectedAmount} for stage ${milestoneStage}, but received BDT ${numericPaid}.`,
    };
  }

  const ratio = job.price > 0 ? Math.min(1, numericPaid / job.price) : 1;
  const proportionalMaterial = Math.round((job.materialCost || 0) * ratio);
  const netProfitPortion = Math.max(0, numericPaid - proportionalMaterial - Number(vatAmount));
  const hasAgent = Boolean(job.agent);

  const normalizedStage = milestoneStage === '30%_FINAL' ? '30%' : milestoneStage;

  const payment = await Payment.create({
    job: job._id,
    payer: payerId,
    amount: numericPaid,
    totalAmount: numericPaid,
    materialCost: proportionalMaterial,
    vatAmount: Number(vatAmount),
    netProfit: netProfitPortion,
    milestoneStage: normalizedStage,
    method,
    trxId: cleanTrxId,
    status: 'EscrowHeld',
    mistriShareAmount: Number((netProfitPortion * 0.80).toFixed(2)),
    agentShareAmount: hasAgent ? Number((netProfitPortion * 0.05).toFixed(2)) : 0,
    platformShareAmount: hasAgent
      ? Number((netProfitPortion * 0.15).toFixed(2))
      : Number((netProfitPortion * 0.20).toFixed(2)),
  });

  let unlockedContactAndChat = false;
  if (milestoneStage === '30%' || milestoneStage === 'Full') {
    job.milestone1Paid = true;
    job.milestoneStages.stage1Paid = true;
    job.milestoneStages.stage1PaidAt = new Date();
    if (milestoneStage === 'Full') {
      job.milestoneStages.stage2Paid = true;
      job.milestoneStages.stage3Paid = true;
    }
    await job.save();
    unlockedContactAndChat = true;
  } else if (milestoneStage === '40%') {
    job.milestoneStages.stage2Paid = true;
    await job.save();
  } else if (milestoneStage === '30%_FINAL') {
    job.milestoneStages.stage3Paid = true;
    await job.save();
  }

  return {
    verified: true,
    status: 'EscrowHeld',
    unlockedContactAndChat,
    message: unlockedContactAndChat
      ? '30% Advance verified in Escrow. Mistri phone number and live chat are now unlocked.'
      : 'Milestone payment verified and locked in Escrow.',
    payment,
  };
};

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
