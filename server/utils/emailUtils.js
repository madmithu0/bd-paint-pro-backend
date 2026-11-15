const nodemailer = require('nodemailer');
const { Queue } = require('bullmq');
const EmailLog = require('../models/EmailLog');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '://gmail.com',
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
  });

  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail({
        from: `"Enterprise Paint Security" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: text || subject,
        html: html || `<p>${text || subject}</p>`,
      });
    }
    emailRecord.status = 'Sent';
    await emailRecord.save();
    return emailRecord;
  } catch (error) {
    emailRecord.status = 'Failed';
    emailRecord.errorMessage = error.message;
    await emailRecord.save();
    throw error;
  }
};

const sendEmailQueue = async ({ to, subject, html, text }) => {
  if (emailQueue) {
    return emailQueue.add('send-email', { to, subject, html, text });
  }
  return dispatchEmailDirect({ to, subject, html, text });
};

// Dedicated Super Admin Gmail OTP Sender (File 38 & 175)
const sendSuperAdminGmailOtp = async (otpCode) => {
  const adminGmail = process.env.SUPER_ADMIN_GMAIL;
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
  sendSuperAdminGmailOtp,
};
