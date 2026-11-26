const AuditLog = require('../models/AuditLog');

const LEGAL_VERSIONS = Object.freeze({
  termsVersion: 'v3.8.0-TOS-2026',
  privacyVersion: 'v3.8.0-PRIVACY-2026',
  refundVersion: 'v3.8.0-REFUND-2026',
  effectiveDate: '2026-01-01',
});

const ROLE_LEGAL_VERSIONS = Object.freeze({
  Customer: 'v3.8.0-CUSTOMER-TOS',
  Mistri: 'v3.8.0-MISTRI-ANTI-POACHING-TOS',
  Agent: 'v3.8.0-AGENT-LEAD-TOS',
  Merchant: 'v3.8.0-MERCHANT-COMMISSION-TOS',
  Admin: 'v3.8.0-ADMIN-POLICY',
  SuperAdmin: 'v3.8.0-SUPERADMIN-POLICY',
});

const validateRoleTermsAcceptance = ({
  role = 'Customer',
  termsAccepted = false,
  merchantCommissionAgreed = false,
}) => {
  if (!termsAccepted) {
    return {
      valid: false,
      code: 'ROLE_TERMS_REQUIRED',
      message: `You must accept the ${role} Terms & Conditions prior to activation.`,
    };
  }

  if (role === 'Merchant' && !merchantCommissionAgreed) {
    return {
      valid: false,
      code: 'MERCHANT_COMMISSION_CONSENT_REQUIRED',
      message: 'Merchant account activation is blocked without explicit 3-5% commission agreement.',
    };
  }

  return {
    valid: true,
    roleVersion: ROLE_LEGAL_VERSIONS[role] || LEGAL_VERSIONS.termsVersion,
  };
};

const recordUserTermsAcceptance = async ({
  userId,
  role = 'Customer',
  merchantCommissionAgreed = false,
  ipAddress,
  deviceInfo,
}) => {
  const roleVersion = ROLE_LEGAL_VERSIONS[role] || LEGAL_VERSIONS.termsVersion;

  await AuditLog.create({
    user: String(userId),
    role,
    action: `ACCEPTED_ROLE_TERMS [${roleVersion}]`,
    category: 'ROLE_TERMS_EDIT',
    ipAddress: ipAddress || '0.0.0.0',
    deviceInfo: deviceInfo || 'Web/PWA Client',
    details: {
      ...LEGAL_VERSIONS,
      role,
      roleVersion,
      merchantCommissionAgreed: role === 'Merchant' ? Boolean(merchantCommissionAgreed) : undefined,
    },
    time: new Date(),
  });

  return {
    accepted: true,
    role,
    roleVersion,
    ...LEGAL_VERSIONS,
    acceptedAt: new Date().toISOString(),
  };
};

module.exports = {
  LEGAL_VERSIONS,
  ROLE_LEGAL_VERSIONS,
  validateRoleTermsAcceptance,
  recordUserTermsAcceptance,
};
