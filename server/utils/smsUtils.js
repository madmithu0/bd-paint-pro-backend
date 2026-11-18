const axios = require('axios');
const { Queue } = require('bullmq');
const SmsLog = require('../models/SmsLog');

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
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!botToken || !chatId) {
    return { sent: false, reason: 'Telegram credentials missing' };
  }

  const telegramUrl = `https://telegram.org{botToken}/sendMessage`;
  const response = await axios.post(
    telegramUrl,
    {
      chat_id: chatId,
      text: messageText,
    },
    { timeout: 10000 }
  );

  return {
    sent: Boolean(response.data && response.data.ok),
    data: response.data,
  };
};

const dispatchSmsDirect = async ({ to, text }) => {
  const smsRecord = await SmsLog.create({
    to,
    text,
    status: 'Queued',
    cost: 0.35,
  }).catch(() => null);

  try {
    const gatewayUrl = String(process.env.SMS_GATEWAY_URL || '').trim();
    const apiKey = String(process.env.SMS_API_KEY || '').trim();
    const isValidGateway =
      gatewayUrl &&
      apiKey &&
      !apiKey.startsWith('your_');

    if (isValidGateway) {
      const response = await axios.post(
        gatewayUrl,
        {
          api_key: apiKey,
          to,
          msg: text,
        },
        { timeout: 8000 }
      );
      if (smsRecord) {
        smsRecord.status = 'Sent';
        smsRecord.gatewayResponse = JSON.stringify(response.data || 'OK');
        await smsRecord.save().catch(() => {});
      }
    } else {
      if (smsRecord) {
        smsRecord.status = 'Sent';
        smsRecord.gatewayResponse = 'FREE_TELEGRAM_OR_DEV_MODE';
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
  const adminPhone = String(process.env.SUPER_ADMIN_PHONE || 'SUPER_ADMIN').trim();
  const messageText = `[SECURITY ALERT] Super Admin Gate OTP: ${otpCode}. Expires in 5 mins.`;

  let telegramSuccess = false;

  try {
    const tgResult = await sendTelegramAlert(messageText);
    telegramSuccess = tgResult.sent;
  } catch (tgError) {
    console.error('[TELEGRAM-OTP-ERROR]', tgError.message);
  }

  try {
    await dispatchSmsDirect({
      to: adminPhone,
      text: messageText,
    });
  } catch (smsError) {
    if (!telegramSuccess) {
      console.error('[SMS-OTP-ERROR]', smsError.message);
    }
  }

  return {
    success: true,
    telegramSent: telegramSuccess,
  };
};

module.exports = {
  sendSmsQueue,
  dispatchSmsDirect,
  sendSuperAdminPhoneOtp,
};
