let activePaymentMode = process.env.PAYMENT_MODE === 'live' ? 'live' : 'sandbox';

const ENDPOINTS = {
  bkash: {
    sandbox: 'https://bka.sh',
    live: 'https://bka.sh',
  },
  nagad: {
    sandbox: 'http://mynagad.com',
    live: 'https://mynagad.com',
  },
};

const paymentEnv = {
  getMode() {
    return activePaymentMode;
  },

  switchMode(newMode) {
    if (!['sandbox', 'live'].includes(newMode)) {
      throw new Error('Payment mode must be either "sandbox" or "live".');
    }
    if (newMode === 'live') {
      this.validateLiveKeys();
    }
    activePaymentMode = newMode;
    return activePaymentMode;
  },

  getActiveUrls() {
    return {
      bkashUrl: process.env.BKASH_BASE_URL || ENDPOINTS.bkash[activePaymentMode],
      nagadUrl: process.env.NAGAD_BASE_URL || ENDPOINTS.nagad[activePaymentMode],
    };
  },

  validateLiveKeys() {
    const required = [
      'BKASH_APP_KEY',
      'BKASH_APP_SECRET',
      'BKASH_USERNAME',
      'BKASH_PASSWORD',
      'NAGAD_MERCHANT_ID',
      'NAGAD_PUBLIC_KEY',
      'NAGAD_PRIVATE_KEY',
    ];
    const missing = required.filter((k) => !process.env[k] || process.env[k].startsWith('your_'));
    if (missing.length > 0) {
      throw new Error(`Cannot switch to LIVE payment mode. Unconfigured keys: ${missing.join(', ')}`);
    }
    return true;
  },

  getGatewayStatus() {
    return {
      mode: activePaymentMode,
      urls: this.getActiveUrls(),
      bkashConfigured: Boolean(process.env.BKASH_APP_KEY),
      nagadConfigured: Boolean(process.env.NAGAD_MERCHANT_ID),
    };
  },
};

module.exports = paymentEnv;
