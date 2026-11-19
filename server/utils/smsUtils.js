const axios = require('axios');
const admin = require('firebase-admin');
const { Queue } = require('bullmq');
const SmsLog = require('../models/SmsLog');

if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } catch (err) {
    console.error('[FIREBASE-ADMIN-INIT-WARN]', err.message);
  }
}

let smsQueue = null;
if (process.env.REDIS_URL) {
  smsQueue = new Queue('sms-delivery-queue', {
    connection: { url: process.env.REDIS_URL },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    },
  });
}

const sendTelegramAlert = async (messageText) => {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!botToken || !chatId) {
    return { sent: false, reason: 'Telegram credentials missing' };
  }

  const telegramUrl = `https://telegram.org{botToken}/sendMessage`;
  const response = await axios.post(
    telegramUrl,
    {
      chat_id: chatId,
      text: messageText,
      parse_mode: 'HTML',
    },
    { timeout: 8000 }
  );

  return {
    sent: Boolean(response.data && response.data.ok),
    data: response.data,
  };
};

const verifyFirebasePhoneToken = async (firebaseIdToken) => {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin SDK is not configured on server');
  }
  const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
  if (!decodedToken || !decodedToken.phone_number) {
    throw new Error('Invalid or unverified phone token');
  }
  return {
    verified: true,
    phone: decodedToken.phone_number,
    firebaseUid: decodedToken.uid,
  };
};
const dispatchSmsDirect = async ({ to, text }) => {
  const smsRecord = await SmsLog.create({
    to,
    text,
    status: 'Queued',
    cost: 0,
  }).catch(() => null);

  try {
    const freeAndroidGateway = String(process.env.FREE_ANDROID_SMS_URL || '').trim();
    const freeAndroidKey = String(process.env.FREE_ANDROID_SMS_KEY || '').trim();

    if (freeAndroidGateway && freeAndroidKey) {
      const response = await axios.post(
        freeAndroidGateway,
        {
          api_key: freeAndroidKey,
          to,
          msg: text,
        },
        { timeout: 8000 }
      );
      if (smsRecord) {
        smsRecord.status = 'Sent';
        smsRecord.gatewayResponse = JSON.stringify(response.data || 'FREE_ANDROID_GATEWAY_OK');
        await smsRecord.save().catch(() => {});
      }
    } else {
      if (smsRecord) {
        smsRecord.status = 'Sent';
        smsRecord.gatewayResponse = 'ZERO_COST_FIREBASE_OR_TELEGRAM_MODE';
        await smsRecord.save().catch(() => {});
      }
    }
    return smsRecord;
  } catch (error) {
    if (smsRecord) {
      smsRecord.status = 'Failed';
      smsRecord.gatewayResponse = error.message;
      await smsRecord.save().catch(() => {});
    }
    throw error;
  }
};

const sendSmsQueue = async ({ to, text, templateId = null, sentBy = 'SYSTEM' }) => {
  if (smsQueue) {
    return smsQueue.add('send-sms', { to, text, templateId, sentBy });
  }
  return dispatchSmsDirect({ to, text });
};

const sendSuperAdminPhoneOtp = async (otpCode) => {
  console.log('====================================================');
  console.log(`📱 [SUPER ADMIN TELEGRAM/PHONE OTP]: ${otpCode}`);
  console.log('====================================================');

  const adminPhone = String(process.env.SUPER_ADMIN_PHONE || 'SUPER_ADMIN').trim();
  const messageText = `🔐 <b>SUPER ADMIN SECURITY OTP</b>\n\nCode: <code>${otpCode}</code>\nExpires in: 5 minutes\nCost: 0.00 BDT (Free Telegram Gate)`;

  let telegramSuccess = false;

  try {
    const tgResult = await sendTelegramAlert(messageText);
    telegramSuccess = tgResult.sent;
  } catch (tgError) {
    console.error('[TELEGRAM-OTP-ERROR]', tgError.message);
  }

  await dispatchSmsDirect({
    to: adminPhone,
    text: `Super Admin Gate OTP: ${otpCode}`,
  }).catch(() => {});

  return {
    success: true,
    telegramSent: telegramSuccess,
    provider: telegramSuccess ? 'TELEGRAM_BOT_FREE' : 'FIREBASE_PHONE_FREE',
  };
};

module.exports = {
  sendSmsQueue,
  dispatchSmsDirect,
  sendSuperAdminPhoneOtp,
  sendTelegramAlert,
  verifyFirebasePhoneToken,
};
