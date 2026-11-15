const mongoose = require('mongoose');
const Payment = require('../../models/Payment');
const Wallet = require('../../models/Wallet');
const { refundBkashTransaction } = require('./bkashLive');
const { refundNagadTransaction } = require('./nagadLive');

const processJobRefund = async ({
  paymentId,
  refundAmount = null,
  refundTo = 'Wallet', // 'Wallet' or 'Gateway'
  reason = 'Job Cancelled by Customer',
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) {
      throw new Error('Payment record not found for refund.');
    }

    if (payment.status === 'Refunded') {
      throw new Error('This payment has already been refunded.');
    }

    if (payment.status === 'Released') {
      throw new Error('Cannot refund after Escrow funds have been released to workers.');
    }

    const finalRefundAmount = refundAmount !== null ? Number(refundAmount) : payment.amount;
    if (finalRefundAmount <= 0 || finalRefundAmount > payment.amount) {
      throw new Error(`Invalid refund amount. Must be between 1 and ${payment.amount} BDT.`);
    }

    let gatewayRefundResponse = null;

    // Option A: Instant Refund to User Internal Wallet
    if (refundTo === 'Wallet') {
      await Wallet.findOneAndUpdate(
        { user: payment.payer },
        {
          $inc: { balance: finalRefundAmount },
          $push: {
            transactions: {
              type: 'REFUND_CREDIT',
              amount: finalRefundAmount,
              jobId: payment.job,
              method: 'Wallet',
              status: 'Completed',
              createdAt: new Date(),
            },
          },
        },
        { upsert: true, new: true, session }
      );
    } else {
      // Option B: Refund directly to bKash or Nagad Gateway with Auto-Retry
      let attempts = 0;
      while (attempts < 3) {
        try {
          attempts += 1;
          if (payment.method === 'Bkash') {
            gatewayRefundResponse = await refundBkashTransaction({
              paymentID: payment.gatewayResponse?.paymentID || payment.trxId,
              trxID: payment.trxId,
              amount: finalRefundAmount,
              reason,
            });
          } else if (payment.method === 'Nagad') {
            gatewayRefundResponse = await refundNagadTransaction({
              paymentRefId: payment.gatewayResponse?.paymentRefId || payment.trxId,
              amount: finalRefundAmount,
              reason,
            });
          }
          break;
        } catch (err) {
          if (attempts >= 3) throw new Error(`Gateway refund failed after 3 retries: ${err.message}`);
          await new Promise((r) => setTimeout(r, 1500 * attempts));
        }
      }
    }

    payment.status = 'Refunded';
    payment.gatewayResponse = {
      ...payment.gatewayResponse,
      refundedAmount: finalRefundAmount,
      refundDestination: refundTo,
      refundReason: reason,
      gatewayRefundResponse,
      refundedAt: new Date().toISOString(),
    };

    await payment.save({ session });
    await session.commitTransaction();

    return {
      success: true,
      refundedAmount: finalRefundAmount,
      refundTo,
      paymentId: payment._id,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = { processJobRefund };
