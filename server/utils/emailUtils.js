const nodemailer = require('nodemailer');
const { Queue } = require('bullmq');
const EmailLog = require('../models/EmailLog');

// 100% Free Gmail SMTP Transporter (Requires Gmail 2FA + 16-digit App Password)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
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
      throw new Error('Free Gmail SMTP_USER or SMTP_PASS is missing in .env');
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
    if (emailRecord) {
      emailRecord.status = 'Failed';
      emailRecord.errorMessage = error.message;
      await emailRecord.save().catch(() => {});
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

// Free Gmail OTP Sender for Customer, Mistri, Agent & Merchant
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
        <p style="font-size:12px;color:#6b7280;">This code is valid for 5 minutes. Do not share this code with anyone.</p>
      </div>
    `,
  });
};

// Dedicated Super Admin Gmail OTP Sender (File 38 & 175)
const sendSuperAdminGmailOtp = async (otpCode) => {
  const adminGmail = process.env.SUPER_ADMIN_GMAIL || process.env.SMTP_USER;
  if (!adminGmail) throw new Error('SUPER_ADMIN_GMAIL not configured in .env');

  return dispatchEmailDirect({
    to: adminGmail,
    subject: `[CRITICAL SECURITY] Super Admin Gate Gmail OTP: ${otpCode}`,
    html: `
      <div style="font-family:sans-serif;padding:20px;border:1px solid #ddd;">
        <h2>Super Admin 4-Layer Verification</h2>
        <p>Your Layer-2 Gmail OTP code is:</p>
        <h1 style="letter-spacing:4px;color:#1d4ed8;">${otpCode}</h1>
        <p>This code expires in 5 minutes. If you did not initiate this request, lock down your IP immediately.</p>
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
