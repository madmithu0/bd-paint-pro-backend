const mongoose = require('mongoose');
const Job = require('../../models/Job');
const Wallet = require('../../models/Wallet');

const distributeJobPayout = async (paymentDoc) => {
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

      const totalAmount = Number(paymentDoc.amount);
      const hasAgent = Boolean(job.agent);

      // Exact Share Split Formula Lock
      const mistriPoolAmount = Number((totalAmount * 0.80).toFixed(2));
      const agentAmount = hasAgent ? Number((totalAmount * 0.05).toFixed(2)) : 0;
      const platformAmount = hasAgent
        ? Number((totalAmount * 0.15).toFixed(2))
        : Number((totalAmount * 0.20).toFixed(2));

      // 1. Equal Split Credit among all assigned Mistris
      const equalPerMistri = Number((mistriPoolAmount / assignedMistris.length).toFixed(2));

      for (const mistriId of assignedMistris) {
        await Wallet.findOneAndUpdate(
          { user: mistriId },
          {
            $inc: { balance: equalPerMistri },
            $push: {
              transactions: {
                type: 'EQUAL_SPLIT_CREDIT',
                amount: equalPerMistri,
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

      // 2. Credit Agent 5% Commission if Agent is attached
      if (hasAgent && agentAmount > 0) {
        await Wallet.findOneAndUpdate(
          { user: job.agent },
          {
            $inc: { balance: agentAmount },
            $push: {
              transactions: {
                type: 'AGENT_COMMISSION',
                amount: agentAmount,
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

module.exports = { distributeJobPayout };
