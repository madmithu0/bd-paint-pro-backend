const axios = require('axios');
const paymentConfig = require('../../config/paymentConfig');
const Payment = require('../../models/Payment');
const { grantBkashToken, createBkashPayment, executeBkashPayment } = require('../../utils/bkashUtils');

const initiateBkashCheckout = async ({ jobId, amount, invoiceNumber }) => {
  const callbackURL = `${paymentConfig.sslDomain}/api/v1/webhooks/bkash/callback`;
  return createBkashPayment({ amount, invoiceNumber, callbackURL });
};

const queryBkashTransaction = async (paymentID) => {
  const tokenData = await grantBkashToken();
  if (tokenData.fallbackMode) return tokenData;

  const response = await axios.post(
    `${paymentConfig.bkash.baseUrl}/tokenized/checkout/payment/status`,
    { paymentID },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: tokenData.id_token,
        'X-APP-Key': paymentConfig.bkash.appKey,
      },
      timeout: 10000,
    }
  );
  return response.data;
};

const refundBkashTransaction = async ({ paymentID, trxID, amount, reason = 'Job Cancelled' }) => {
  const tokenData = await grantBkashToken();
  if (tokenData.fallbackMode) return tokenData;

  const response = await axios.post(
    `${paymentConfig.bkash.baseUrl}/tokenized/checkout/payment/refund`,
    {
      paymentID,
      amount: String(amount),
      trxID,
      sku: 'PAINT-JOB',
      reason,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: tokenData.id_token,
        'X-APP-Key': paymentConfig.bkash.appKey,
      },
      timeout: 10000,
    }
  );
  return response.data;
};

// Webhook Callback Handler (Connected in server.js)
const handleCallback = async (req, res, next) => {
  try {
    const { paymentID, status, expectedAmount } = req.body;
    if (status !== 'success' || !paymentID) {
      return res.status(400).json({ success: false, message: 'bKash payment cancelled or failed.' });
    }

    const execResult = await executeBkashPayment(paymentID);

    // Reject if paid amount differs even by 1 Taka
    if (expectedAmount && Number(execResult.amount) !== Number(expectedAmount)) {
      return res.status(400).json({
        success: false,
        message: 'Wrong payment amount detected and auto-rejected.',
      });
    }

    if (execResult.trxID) {
      await Payment.findOneAndUpdate(
        { trxId: execResult.trxID },
        { status: 'EscrowHeld', gatewayResponse: execResult }
      );
    }

    res.status(200).json({ success: true, data: execResult });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateBkashCheckout,
  queryBkashTransaction,
  refundBkashTransaction,
  handleCallback,
};
