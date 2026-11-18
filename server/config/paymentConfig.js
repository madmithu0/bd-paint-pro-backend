const paymentConfig = {
  versionLock: 'v3.0.0-PAYMENT-LOCK',

  // bKash Live/Sandbox Gateway Configuration
  bkash: {
    baseUrl: process.env.BKASH_BASE_URL || 'https://bka.sh',
    appKey: process.env.BKASH_APP_KEY || '',
    appSecret: process.env.BKASH_APP_SECRET || '',
    username: process.env.BKASH_USERNAME || '',
    password: process.env.BKASH_PASSWORD || '',
    callbackUrl: process.env.BKASH_CALLBACK_URL || '',
  },

  // Nagad Live/Sandbox Gateway Configuration
  nagad: {
    baseUrl: process.env.NAGAD_BASE_URL || 'http://mynagad.com',
    merchantId: process.env.NAGAD_MERCHANT_ID || '',
    merchantNumber: process.env.NAGAD_MERCHANT_NUMBER || '',
    publicKey: process.env.NAGAD_PUBLIC_KEY || '',
    privateKey: process.env.NAGAD_PRIVATE_KEY || '',
    callbackUrl: process.env.NAGAD_CALLBACK_URL || '',
  },

  // ZERO-COST FREE OTP & NOTIFICATION CONFIGURATION (Replaces Paid SMS Gateway)
  freeOtpConfig: {
    enabled: true,
    paidSmsGatewayDisabled: true,
    phoneProvider: 'FIREBASE_FREE_TIER', // 10,000 Free Phone OTPs/month
    emailProvider: 'GMAIL_SMTP_FREE',     // 500 Free Gmail OTPs/day via Nodemailer
    superAdminBackupProvider: 'TELEGRAM_BOT_FREE', // Unlimited Free Telegram OTP
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
  },

  // SSL & Hosting Security Lock
  hosting: {
    sslDomain: process.env.SSL_DOMAIN || 'https://localhost:5000',
    enforceHttps: process.env.NODE_ENV === 'production',
  },
};

module.exports = paymentConfig;
