const mongoose = require('mongoose');
const Job = require('../../models/Job');
const Wallet = require('../../models/Wallet');
const User = require('../../models/User');
const OTP = require('../../models/OTP');

const authorizePayoutRelease = async ({ transactionPin, otpCode, adminPhone, adminEmail }) => {
  const configuredPin = String(process.env.SUPER_ADMIN_TRANSACTION_PIN || process.env.TRANSACTION_PIN || '').trim();
  if (!configuredPin || String(transactionPin || '').trim() !== configuredPin) {
    throw new Error('SECURITY BLOCK: Invalid Super Admin Transaction PIN for payout release.');
  }

  if (otpCode) {
    const validOtp = await OTP.findOne({
      $or: [{ phone: adminPhone }, { email: adminEmail }],
      code: String(otpCode).trim(),
      purpose: { $in: ['SUPER_ADMIN_2FA', 'SUPER_ADMIN_PHONE', 'SUPER_ADMIN_GMAIL'] },
      expiresAt: { $gt: new Date() },
    });
    if (!validOtp) {
      throw new Error('SECURITY BLOCK: Invalid or expired Super Admin 2FA OTP for payout release.');
    }
    validOtp.verified = true;
    await validOtp.save();
  }
  return true;
};

const distributeJobPayout = async (paymentDoc, authOptions = null) => {
  if (authOptions && authOptions.enforcePinGate) {
    await authorizePayoutRelease(authOptions);
  }

  let attempt = 0;
  const maxRetries = 3;

  while (attempt < maxRetries) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      attempt += 1;
      const job = await Job.findById(paymentDoc.job).session(session);
      if (!job) {
        throw new Error('Associated job not found for payout distribution.');
      }

      const assignedMistris = job.assignedMistri || [];
      if (assignedMistris.length === 0) {
        throw new Error('No Mistri assigned to this job. Cannot distribute 80% Mistri pool.');
      }

      const materialCost = Number(paymentDoc.materialCost || 0);
      const vatAmount = Number(paymentDoc.vatAmount || 0);
      const distributableNetProfit =
        Number(paymentDoc.netProfit) > 0
          ? Number(paymentDoc.netProfit)
          : Math.max(0, Number(paymentDoc.amount) - materialCost - vatAmount);

      const hasAgent = Boolean(job.agent);
      const mistriPoolAmount = Number((distributableNetProfit * 0.80).toFixed(2));
      const agentAmount = hasAgent ? Number((distributableNetProfit * 0.05).toFixed(2)) : 0;
      const platformAmount = hasAgent
        ? Number((distributableNetProfit * 0.15).toFixed(2))
        : Number((distributableNetProfit * 0.20).toFixed(2));

      const equalPerMistri = Number((mistriPoolAmount / assignedMistris.length).toFixed(2));

      for (const mistriId of assignedMistris) {
        const mistriUser = await User.findById(mistriId).select('walletAccounts').session(session);
        const verifiedAcc = mistriUser?.walletAccounts?.find((w) => w.isVerified);

        await Wallet.findOneAndUpdate(
          { user: mistriId },
          {
            $inc: { balance: equalPerMistri },
            $push: {
              transactions: {
                type: 'EQUAL_SPLIT_CREDIT',
                amount: equalPerMistri,
                jobId: job._id,
                method: verifiedAcc?.provider || 'Wallet',
                accountNumber: verifiedAcc?.accountNumber || null,
                status: 'Completed',
                createdAt: new Date(),
              },
            },
          },
          { upsert: true, new: true, session }
        );
      }
      if (hasAgent && agentAmount > 0) {
        const agentUser = await User.findById(job.agent).select('walletAccounts').session(session);
        const agentAcc = agentUser?.walletAccounts?.find((w) => w.isVerified);

        await Wallet.findOneAndUpdate(
          { user: job.agent },
          {
            $inc: { balance: agentAmount },
            $push: {
              transactions: {
                type: 'AGENT_COMMISSION',
                amount: agentAmount,
                jobId: job._id,
                method: agentAcc?.provider || 'Wallet',
                accountNumber: agentAcc?.accountNumber || null,
                status: 'Completed',
                createdAt: new Date(),
              },
            },
          },
          { upsert: true, new: true, session }
        );
      }

      if (materialCost > 0 && paymentDoc.merchantId) {
        const commission = Number(paymentDoc.merchantCommission || (materialCost * 0.04).toFixed(2));
        const netPayable = Math.max(0, materialCost - commission);

        await Wallet.findOneAndUpdate(
          { user: paymentDoc.merchantId },
          {
            $inc: { balance: netPayable },
            $push: {
              merchantSettlementLedger: {
                jobId: job._id,
                grossAmount: materialCost,
                commissionDeducted: commission,
                netPayable,
                settledAt: new Date(),
              },
              transactions: {
                type: 'MERCHANT_SETTLEMENT',
                amount: netPayable,
                jobId: job._id,
                method: 'Wallet',
                status: 'Completed',
                createdAt: new Date(),
              },
            },
          },
          { upsert: true, new: true, session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      return {
        distributed: true,
        mistriCount: assignedMistris.length,
        perMistriCredited: equalPerMistri,
        agentCredited: agentAmount,
        platformRetained: platformAmount,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      if (attempt >= maxRetries) {
        throw new Error(`Split payout failed after ${maxRetries} retries: ${error.message}`);
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
};

module.exports = { authorizePayoutRelease, distributeJobPayout };
