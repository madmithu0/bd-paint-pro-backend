const axios = require('axios');
const paymentConfig = require('../../config/paymentConfig');
const Payment = require('../../models/Payment');
const { createNagadPayment, verifyNagadPayment } = require('../../utils/nagadUtils');

const initiateNagadCheckout = async ({ orderId, amount }) => {
  const callbackUrl = `${paymentConfig.sslDomain}/api/v1/webhooks/nagad/callback`;
  return createNagadPayment({ orderId, amount, callbackUrl });
};

const refundNagadTransaction = async ({ paymentRefId, amount, reason = 'Job Cancelled' }) => {
  const response = await axios.post(
    `${paymentConfig.nagad.baseUrl}/purchase/cancel`,
    {
      merchantId: paymentConfig.nagad.merchantId,
      paymentRefId,
      cancelAmount: String(amount),
      reason,
    },
    { timeout: 10000 }
  );
  return response.data;
};

// Webhook Callback Handler (Connected in server.js)
const handleCallback = async (req, res, next) => {
  try {
    const { payment_ref_id, status } = req.body;
    if (status !== 'Success' || !payment_ref_id) {
      return res.status(400).json({ success: false, message: 'Nagad payment failed or cancelled.' });
    }

    const verification = await verifyNagadPayment(payment_ref_id);
    if (verification.issuerPaymentRefNo) {
      await Payment.findOneAndUpdate(
        { trxId: verification.issuerPaymentRefNo },
        { status: 'EscrowHeld', gatewayResponse: verification }
      );
    }

    res.status(200).json({ success: true, data: verification });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateNagadCheckout,
  verifyNagadPayment,
  refundNagadTransaction,
  handleCallback,
};
