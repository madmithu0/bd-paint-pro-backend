const axios = require('axios');
const CircuitBreaker = require('opossum');
const paymentConfig = require('../config/paymentConfig');

const bkashApiCall = async (endpoint, payload, headers = {}) => {
  const url = `${paymentConfig.bkash.baseUrl}${endpoint}`;
  const response = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-APP-Key': paymentConfig.bkash.appKey,
      ...headers,
    },
    timeout: 10000,
  });
  return response.data;
};

// Wrap bKash API with Opossum Circuit Breaker (Self-Healing)
const bkashBreaker = new CircuitBreaker(bkashApiCall, {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 15000,
});

bkashBreaker.fallback(() => ({
  statusCode: '503',
  statusMessage: 'bKash gateway temporarily busy. Switched to Safe Manual TrxID Verification Mode.',
  fallbackMode: true,
}));

const grantBkashToken = async () => {
  return bkashBreaker.fire('/tokenized/checkout/token/grant', {
    app_key: paymentConfig.bkash.appKey,
    app_secret: paymentConfig.bkash.appSecret,
  }, {
    username: paymentConfig.bkash.username,
    password: paymentConfig.bkash.password,
  });
};

const createBkashPayment = async ({ amount, invoiceNumber, callbackURL }) => {
  const tokenData = await grantBkashToken();
  if (tokenData.fallbackMode) return tokenData;

  return bkashBreaker.fire(
    '/tokenized/checkout/create',
    {
      mode: '0011',
      payerReference: invoiceNumber,
      callbackURL,
      amount: String(amount),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: invoiceNumber,
    },
    { Authorization: tokenData.id_token }
  );
};

const executeBkashPayment = async (paymentID) => {
  const tokenData = await grantBkashToken();
  if (tokenData.fallbackMode) return tokenData;

  return bkashBreaker.fire(
    '/tokenized/checkout/execute',
    { paymentID },
    { Authorization: tokenData.id_token }
  );
};

module.exports = {
  grantBkashToken,
  createBkashPayment,
  executeBkashPayment,
};
