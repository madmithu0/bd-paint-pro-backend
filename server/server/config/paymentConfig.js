const PAYMENT_VERSION_LOCK = 'v3.0.0-BD-LIVE';

const paymentConfig = {
  versionLock: PAYMENT_VERSION_LOCK,
  mode: process.env.PAYMENT_MODE || 'sandbox', // 'sandbox' or 'live'
  sslDomain: process.env.SSL_DOMAIN || 'https://yourdomain.com',
  hostingRegion: 'ap-southeast-1',

  bkash: {
    baseUrl: process.env.BKASH_BASE_URL,
    appKey: process.env.BKASH_APP_KEY,
    appSecret: process.env.BKASH_APP_SECRET,
    username: process.env.BKASH_USERNAME,
    password: process.env.BKASH_PASSWORD,
    currency: 'BDT',
    intent: 'sale',
  },

  nagad: {
    baseUrl: process.env.NAGAD_BASE_URL,
    merchantId: process.env.NAGAD_MERCHANT_ID,
    merchantNumber: process.env.NAGAD_MERCHANT_NUMBER,
    publicKey: process.env.NAGAD_PUBLIC_KEY,
    privateKey: process.env.NAGAD_PRIVATE_KEY,
    currency: 'BDT',
  },

  smsGateway: {
    url: process.env.SMS_GATEWAY_URL,
    apiKey: process.env.SMS_API_KEY,
    senderId: process.env.SMS_SENDER_ID || '8809617600000',
  },

  // Profit Share Lock (Mistri 80%, Agent 5% + Platform 15% OR Platform 20%)
  shareRules: {
    mistriPercent: 80,
    agentPercent: 5,
    platformWithAgentPercent: 15,
    platformDirectPercent: 20,
  },

  validateConfig() {
    if (this.mode === 'live') {
      const requiredKeys = [
        'BKASH_APP_KEY',
        'BKASH_APP_SECRET',
        'NAGAD_MERCHANT_ID',
        'NAGAD_PRIVATE_KEY',
        'SMS_API_KEY',
      ];
      const missing = requiredKeys.filter((key) => !process.env[key]);
      if (missing.length > 0) {
        throw new Error(`[PAYMENT CONFIG FATAL] Missing live payment keys: ${missing.join(', ')}`);
      }
    }
    console.log(`💳 [PAYMENT CONFIG] Loaded (${this.mode.toUpperCase()} MODE | ${this.versionLock})`);
    return true;
  },
};

module.exports = paymentConfig;
