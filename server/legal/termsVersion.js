const AuditLog = require('../models/AuditLog');

const LEGAL_VERSIONS = Object.freeze({
  termsVersion: 'v3.0.0-TOS-2026',
  privacyVersion: 'v3.0.0-PRIVACY-2026',
  refundVersion: 'v3.0.0-REFUND-2026',
  effectiveDate: '2026-01-01',
});

const recordUserTermsAcceptance = async ({ userId, ipAddress, deviceInfo }) => {
  await AuditLog.create({
    user: String(userId),
    action: `ACCEPTED_LEGAL_TERMS [${LEGAL_VERSIONS.termsVersion}]`,
    category: 'GENERAL',
    ipAddress: ipAddress || '0.0.0.0',
    deviceInfo: deviceInfo || 'Web/PWA Client',
    details: LEGAL_VERSIONS,
    time: new Date(),
  });

  return {
    accepted: true,
    ...LEGAL_VERSIONS,
    acceptedAt: new Date().toISOString(),
  };
};

module.exports = {
  LEGAL_VERSIONS,
  recordUserTermsAcceptance,
};
