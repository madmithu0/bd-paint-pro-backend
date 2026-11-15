const axios = require('axios');
const CircuitBreaker = require('opossum');
const paymentConfig = require('../config/paymentConfig');

const nagadApiRequest = async ({ method = 'POST', endpoint, data = {} }) => {
  const url = `${paymentConfig.nagad.baseUrl}${endpoint}`;
  const response = await axios({
    method,
    url,
    data,
    headers: {
      'Content-Type': 'application/json',
      'X-KM-Api-Version': 'v-0.2.0',
      'X-KM-IP-V4': '127.0.0.1',
      'X-KM-Client-Type': 'PC_WEB',
    },
    timeout: 10000,
  });
  return response.data;
};

// Wrap Nagad API with Opossum Circuit Breaker (Self-Healing)
const nagadBreaker = new CircuitBreaker(nagadApiRequest, {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 15000,
});

nagadBreaker.fallback(() => ({
  status: 'Failed',
  message: 'Nagad gateway temporarily unavailable. Safe Manual TrxID Verification active.',
  fallbackMode: true,
}));

const createNagadPayment = async ({ orderId, amount, callbackUrl }) => {
  return nagadBreaker.fire({
    method: 'POST',
    endpoint: `/check-out/initialize/${paymentConfig.nagad.merchantId}/${orderId}`,
    data: {
      accountNumber: paymentConfig.nagad.merchantNumber,
      dateTime: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
      amount: String(amount),
      orderId,
      callbackUrl,
    },
  });
};

const verifyNagadPayment = async (paymentRefId) => {
  return nagadBreaker.fire({
    method: 'GET',
    endpoint: `/verify/payment/${paymentRefId}`,
  });
};

module.exports = {
  createNagadPayment,
  verifyNagadPayment,
};
