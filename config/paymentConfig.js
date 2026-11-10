const env = require('./env');

function required(name, value) {
  if (!value) throw new Error(`${name} missing in .env`);
  return value;
}

const config = {
  bkash: {
    username: process.env.BKASH_USERNAME || '',
    password: process.env.BKASH_PASSWORD || '',
    appKey: process.env.BKASH_APP_KEY || '',
    appSecret: process.env.BKASH_APP_SECRET || ''
  },
  nagad: {
    merchantId: process.env.NAGAD_MERCHANT_ID || '',
    merchantNumber: process.env.NAGAD_MERCHANT_NUMBER || '',
    publicKey: process.env.NAGAD_PUBLIC_KEY || '',
    privateKey: process.env.NAGAD_PRIVATE_KEY || ''
  },
  sms: {
    apiKey: process.env.SMS_API_KEY || '',
    senderId: env.btrc
  },
  version: '1.0.0'
};

config.validate = function () {
  if (process.env.DEV_MODE === 'false') {
    required('BKASH_USERNAME', config.bkash.username);
    required('BKASH_APP_KEY', config.bkash.appKey);
    required('NAGAD_MERCHANT_ID', config.nagad.merchantId);
    required('SMS_API_KEY', config.sms.apiKey);
  }
};

config.validate();

module.exports = config;