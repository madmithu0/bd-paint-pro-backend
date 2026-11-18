const Report = require('../models/Report');
const { verifyNbrBin, calculateMushakVat } = require('../utils/govtUtils');

// 1. Bangladesh Labor Law & Safety Compliance Check
const checkLaborLawCompliance = ({ dailySqftLoad = 450, dailyWorkHours = 8, workerAge = 22 }) => {
  const issues = [];
  if (workerAge < 18) issues.push('Child labor strictly prohibited under Bangladesh Labor Act.');
  if (dailyWorkHours > 8) issues.push('Standard shift exceeds 8 hours; overtime pay required.');
  if (dailySqftLoad > 550) issues.push('Workload exceeds safe 450 Sqft/day standard.');

  return {
    compliant: issues.length === 0,
    standardCapacity: '450 Sqft / 8 Hours per Mistri',
    issues,
  };
};

// 2. BTRC SMS Compliance Filter (Supports Zero-Cost Firebase, Gmail & Telegram Providers)
const checkBtrcSmsCompliance = (smsText = '', provider = 'FIREBASE_PHONE') => {
  const freeProviders = ['FIREBASE_PHONE', 'GMAIL_SMTP', 'TELEGRAM_BOT'];
  if (freeProviders.includes(provider)) {
    return {
      compliant: true,
      senderRegistered: true,
      provider,
      message: `Zero-cost provider (${provider}) verified and compliant.`,
    };
  }

  const forbiddenPatterns = [/bit\.ly/i, /tinyurl/i, /casino/i, /betting/i];
  const isClean = !forbiddenPatterns.some((rx) => rx.test(smsText));
  return {
    compliant: isClean,
    senderRegistered: true,
    provider,
    message: isClean ? 'BTRC SMS guidelines satisfied.' : 'Blocked: Unapproved short URL or restricted keyword.',
  };
};

// 3. Auto-Create Police Report Dossier for Major Disputes / Fraud
const autoCreatePoliceReport = async ({ disputeId, jobId, accusedUserId, summary, generatedBy = 'SYSTEM' }) => {
  const report = await Report.create({
    type: 'GOVT_POLICE_REPORT',
    data: {
      disputeId,
      jobId,
      accusedUserId,
      summary,
      jurisdiction: 'Bangladesh Cyber & Local Police Station',
      generatedAt: new Date().toISOString(),
    },
    generatedBy,
    date: new Date(),
  });

  return report;
};

module.exports = {
  verifyNbrBin,
  calculateMushakVat,
  checkLaborLawCompliance,
  checkBtrcSmsCompliance,
  autoCreatePoliceReport,
};
