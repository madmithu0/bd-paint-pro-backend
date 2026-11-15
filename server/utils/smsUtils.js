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

// Direct Gateway Sender with Log
const dispatchSmsDirect = async ({ to, text }) => {
  const smsRecord = await SmsLog.create({
    to,
    text,
    status: 'Queued',
    cost: 0.35,
  });

  try {
    if (process.env.SMS_GATEWAY_URL && process.env.SMS_API_KEY) {
      const response = await axios.post(
        process.env.SMS_GATEWAY_URL,
        {
          api_key: process.env.SMS_API_KEY,
          to,
          msg: text,
        },
        { timeout: 8000 }
      );
      smsRecord.status = 'Sent';
      smsRecord.gatewayResponse = JSON.stringify(response.data || 'OK');
    } else {
      smsRecord.status = 'Sent';
      smsRecord.gatewayResponse = 'DEV_SIMULATED_SENT';
    }
    await smsRecord.save();
    return smsRecord;
  } catch (error) {
    smsRecord.status = 'Failed';
    smsRecord.gatewayResponse = error.message;
    await smsRecord.save();
    throw error;
  }
};

// Queue SMS via BullMQ (Falls back to direct send if Redis unavailable)
const sendSmsQueue = async ({ to, text, templateId = null, sentBy = 'SYSTEM' }) => {
  if (smsQueue) {
    return smsQueue.add('send-sms', { to, text, templateId, sentBy });
  }
  return dispatchSmsDirect({ to, text });
};

// Dedicated Super Admin Phone OTP Sender (File 38 & 175)
const sendSuperAdminPhoneOtp = async (otpCode) => {
  const adminPhone = process.env.SUPER_ADMIN_PHONE;
  if (!adminPhone) throw new Error('SUPER_ADMIN_PHONE not configured in .env');

  return dispatchSmsDirect({
    to: adminPhone,
    text: `[SECURITY ALERT] Super Admin Gate Phone OTP: ${otpCode}. Expires in 5 mins.`,
  });
};

module.exports = {
  sendSmsQueue,
  dispatchSmsDirect,
  sendSuperAdminPhoneOtp,
};
