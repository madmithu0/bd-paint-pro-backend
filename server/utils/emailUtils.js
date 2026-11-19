const nodemailer = require('nodemailer');
const { Queue } = require('bullmq');
const EmailLog = require('../models/EmailLog');

// Free Gmail SMTP Transporter with strict timeout (prevents Render hang)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: (Number(process.env.SMTP_PORT) || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 5000, // 5 seconds timeout instead of hanging
  greetingTimeout: 5000,
  socketTimeout: 5000,
});

let emailQueue = null;
if (process.env.REDIS_URL) {
  emailQueue = new Queue('email-delivery-queue', {
    connection: { url: process.env.REDIS_URL },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    },
  });
}

const dispatchEmailDirect = async ({ to, subject, html, text }) => {
  const emailRecord = await EmailLog.create({
    to,
    subject,
    status: 'Queued',
  }).catch(() => null);

  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP_USER or SMTP_PASS is missing in .env');
    }

    await transporter.sendMail({
      from: `"Enterprise Paint Security" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || subject,
      html: html || `<p>${text || subject}</p>`,
    });

    if (emailRecord) {
      emailRecord.status = 'Sent';
      await emailRecord.save().catch(() => {});
    }
    return emailRecord;
  } catch (error) {
    console.error('⚠️ Email SMTP Warning (Render blocks SMTP ports on free tier):', error.message);
    if (emailRecord) {
      emailRecord.status = 'Failed';
      emailRecord.errorMessage = error.message;
      await emailRecord.save().catch(() => {});
    }
    // Do not throw error for Super Admin OTP so the API doesn't fail with 500 Timeout
    if (subject.includes('Super Admin')) {
      return { status: 'Fallback_Logged', message: error.message };
    }
    throw error;
  }
};

const sendEmailQueue = async ({ to, subject, html, text }) => {
  if (emailQueue) {
    return emailQueue.add('send-email', { to, subject, html, text });
  }
  return dispatchEmailDirect({ to, subject, html, text });
};

const sendUserGmailOtp = async ({ email, otpCode, purpose = 'Verification' }) => {
  return dispatchEmailDirect({
    to: email,
    subject: `Your ${purpose} OTP Code: ${otpCode}`,
    html: `
      <div style="font-family:sans-serif;padding:20px;border:1px solid #e5e7eb;border-radius:8px;max-width:480px;">
        <h2 style="color:#111827;margin-bottom:8px;">Account ${purpose}</h2>
        <p style="color:#4b5563;">Use the following 6-digit code to verify your Gmail address:</p>
        <div style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#2563eb;margin:16px 0;">
          ${otpCode}
        </div>
        <p style="font-size:12px;color:#6b7280;">This code is valid for 5 minutes.</p>
      </div>
    `,
  });
};

// Dedicated Super Admin Gmail OTP Sender (File 38 & 175)
const sendSuperAdminGmailOtp = async (otpCode) => {
  // Always print OTP in Render Logs as a guaranteed fallback
  console.log('====================================================');
  console.log(`🔐 [SUPER ADMIN GMAIL OTP]: ${otpCode}`);
  console.log('====================================================');

  const adminGmail = process.env.SUPER_ADMIN_GMAIL || process.env.SMTP_USER;
  if (!adminGmail) {
    console.warn('⚠️ SUPER_ADMIN_GMAIL not set, using Render Logs OTP only.');
    return { status: 'Logged_Only' };
  }

  return dispatchEmailDirect({
    to: adminGmail,
    subject: `[CRITICAL SECURITY] Super Admin Gate Gmail OTP: ${otpCode}`,
    html: `
      <div style="font-family:sans-serif;padding:20px;border:1px solid #ddd;">
        <h2>Super Admin 4-Layer Verification</h2>
        <p>Your Layer-2 Gmail OTP code is:</p>
        <h1 style="letter-spacing:4px;color:#1d4ed8;">${otpCode}</h1>
        <p>This code expires in 5 minutes.</p>
      </div>
    `,
  });
};

module.exports = {
  sendEmailQueue,
  dispatchEmailDirect,
  sendUserGmailOtp,
  sendSuperAdminGmailOtp,
};
