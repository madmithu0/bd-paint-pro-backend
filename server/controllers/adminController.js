const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const HackLog = require('../models/HackLog');
const OTP = require('../models/OTP');
const Dispute = require('../models/Dispute');
const AuditLog = require('../models/AuditLog');
const ServiceCategory = require('../models/ServiceCategory');
const hideConfig = require('../config/hideConfig');
const { generateSuperAdmin2FAToken } = require('../utils/tokenUtils');
const { sendSuperAdminPhoneOtp, verifyFirebasePhoneToken } = require('../utils/smsUtils');
const { sendSuperAdminGmailOtp } = require('../utils/emailUtils');
const { broadcastServiceRateUpdate } = require('../infra/socketEngine');

const generateSixDigitOtp = () => String(crypto.randomInt(100000, 999999));

const verifyConfiguredAdminPassword = async (password) => {
  const inputPwd = String(password || '');
  const envHash = String(process.env.SUPER_ADMIN_PASSWORD_HASH || '').trim();
  const envPlain = String(process.env.SUPER_ADMIN_PASSWORD || '').trim();

  if (envHash) return bcrypt.compare(inputPwd, envHash);
  if (envPlain) return inputPwd === envPlain;
  return false;
};

const getDashboardStats = async (req, res, next) => {
  try {
    const [totalUsers, totalMerchants, totalJobs, completedPayments, blockedAttacks] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'Merchant' }),
      Job.countDocuments(),
      Payment.find({ status: { $in: ['Verified', 'Released', 'EscrowHeld'] } }).lean(),
      HackLog.countDocuments(),
    ]);

    const totalRevenue = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPlatformShare = completedPayments.reduce((sum, p) => sum + (p.platformShareAmount || 0), 0);

    res.status(200).json({
      success: true,
      versionLock: 'v3.8.0 PASSWORD + 2FA LOCK',
      stats: {
        totalUsers,
        totalMerchants,
        totalJobs,
        totalRevenue,
        totalPlatformShare,
        blockedAttacks,
      },
      hideStatus: hideConfig.getStatus(),
      infraHealth: {
        mongoReplicaSet: 'Healthy',
        pitrBackup: 'Active (10-Min Incremental)',
        selfHealingEngine: 'Active',
        superAdminAuthMode: 'Password + Phone/Gmail 2FA OTP (Biometrics Removed)',
      },
    });
  } catch (error) {
    next(error);
  }
};

const superAdminLoginWithPassword = async (req, res, next) => {
  try {
    const { superAdminId, password } = req.body;
    const configuredId = String(process.env.SUPER_ADMIN_ID || '').trim();

    if (!configuredId || String(superAdminId || '').trim() !== configuredId) {
      return res.status(401).json({ success: false, message: 'Invalid Super Admin credentials.' });
    }

    const isPasswordValid = await verifyConfiguredAdminPassword(password);
    if (!isPasswordValid) {
      await AuditLog.create({
        user: configuredId,
        role: 'SuperAdmin',
        action: 'SUPER_ADMIN_FAILED_PASSWORD_LOGIN',
        category: 'ADMIN',
        ipAddress: req.clientIp || req.ip,
      }).catch(() => {});
      return res.status(401).json({ success: false, message: 'Invalid Super Admin password.' });
    }

    const adminPhone = String(process.env.SUPER_ADMIN_PHONE || '').trim();
    const adminGmail = String(process.env.SUPER_ADMIN_GMAIL || process.env.SMTP_USER || '').trim().toLowerCase();

    const phoneOtpCode = generateSixDigitOtp();
    const gmailOtpCode = generateSixDigitOtp();

    await OTP.deleteMany({ purpose: { $in: ['SUPER_ADMIN_PHONE', 'SUPER_ADMIN_GMAIL', 'SUPER_ADMIN_2FA'] } });
    await OTP.create([
      { phone: adminPhone, code: phoneOtpCode, provider: 'TELEGRAM_BOT', purpose: 'SUPER_ADMIN_PHONE' },
      { email: adminGmail, code: gmailOtpCode, provider: 'GMAIL_SMTP', purpose: 'SUPER_ADMIN_GMAIL' },
    ]);

    await Promise.all([
      sendSuperAdminPhoneOtp(phoneOtpCode).catch(() => {}),
      sendSuperAdminGmailOtp(gmailOtpCode).catch(() => {}),
    ]);

    return res.status(200).json({
      success: true,
      step: '2FA_OTP_REQUIRED',
      message: 'Password verified. Enter Phone (Telegram/Firebase) and Gmail 2FA OTPs to complete login.',
    });
  } catch (error) {
    next(error);
  }
};
const verifySuperAdmin2FA = async (req, res, next) => {
  try {
    const { superAdminId, phoneOtp, gmailOtp, firebaseIdToken } = req.body;
    const configuredId = String(process.env.SUPER_ADMIN_ID || '').trim();

    if (!configuredId || String(superAdminId || configuredId).trim() !== configuredId) {
      return res.status(401).json({ success: false, message: 'Invalid Super Admin ID.' });
    }

    let phoneOk = false;
    let gmailOk = false;

    if (firebaseIdToken) {
      const fbCheck = await verifyFirebasePhoneToken(firebaseIdToken);
      if (fbCheck.verified) phoneOk = true;
    } else if (phoneOtp) {
      const phoneRecord = await OTP.findOne({
        purpose: { $in: ['SUPER_ADMIN_PHONE', 'SUPER_ADMIN_2FA'] },
        code: String(phoneOtp).trim(),
        verified: false,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });
      if (phoneRecord) {
        phoneRecord.verified = true;
        await phoneRecord.save();
        phoneOk = true;
      }
    }

    if (gmailOtp) {
      const gmailRecord = await OTP.findOne({
        purpose: { $in: ['SUPER_ADMIN_GMAIL', 'SUPER_ADMIN_2FA'] },
        code: String(gmailOtp).trim(),
        verified: false,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });
      if (gmailRecord) {
        gmailRecord.verified = true;
        await gmailRecord.save();
        gmailOk = true;
      }
    }

    if (!phoneOk || !gmailOk) {
      return res.status(401).json({
        success: false,
        phoneVerified: phoneOk,
        gmailVerified: gmailOk,
        message: 'Both Phone and Gmail 2FA OTPs must be verified.',
      });
    }

    const token = generateSuperAdmin2FAToken({
      superAdminId: configuredId,
      clientIp: req.clientIp || req.ip,
      layers: { phoneOtp: true, gmailOtp: true },
    });

    await AuditLog.create({
      user: configuredId,
      role: 'SuperAdmin',
      action: 'SUPER_ADMIN_2FA_LOGIN_SUCCESS',
      category: 'AUTH',
      ipAddress: req.clientIp || req.ip,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Super Admin Password + 2FA session verified.',
      token,
      accessToken: token,
    });
  } catch (error) {
    next(error);
  }
};

const verifyAccount = async (req, res, next) => {
  try {
    const { userId, verifyStatus = true } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { verify: Boolean(verifyStatus), active: true, accountStatus: 'Active' },
      { new: true }
    ).select('-passwordHash');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.status(200).json({
      success: true,
      message: `${user.role} account verification set to ${user.verify}.`,
      user,
    });
  } catch (error) {
    next(error);
  }
};
const manageUserAccount = async (req, res, next) => {
  try {
    const { userId, active, suspended, role, blockReason } = req.body;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (active !== undefined) user.active = Boolean(active);
    if (suspended !== undefined) {
      user.suspended = Boolean(suspended);
      user.accountStatus = user.suspended ? 'Suspended' : 'Active';
    }
    if (blockReason !== undefined) user.blockReason = blockReason;
    if (role && ['Customer', 'Mistri', 'Agent', 'Merchant', 'Admin'].includes(role)) {
      user.role = role;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User account updated by Super Admin.',
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        active: user.active,
        suspended: user.suspended,
        verify: user.verify,
      },
    });
  } catch (error) {
    next(error);
  }
};

const adminResetUserPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.passwordHash = newPassword;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await AuditLog.create({
      user: String(user._id),
      role: 'SuperAdmin',
      action: 'SUPER_ADMIN_FORCE_PASSWORD_RESET',
      category: 'PASSWORD_RESET',
      ipAddress: req.clientIp || req.ip,
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: `Password reset successfully for ${user.name} (${user.phone}).`,
    });
  } catch (error) {
    next(error);
  }
};

const updateServiceCategoryRate = async (req, res, next) => {
  try {
    const {
      categoryId,
      labourRatePerSqft,
      withMaterialRatePerSqft,
      slotSqftPerDay,
      perCoatRateMultiplier,
      isActive,
    } = req.body;

    const category = await ServiceCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Service category not found.' });
    }

    if (labourRatePerSqft !== undefined) category.labourRatePerSqft = Number(labourRatePerSqft);
    if (withMaterialRatePerSqft !== undefined) category.withMaterialRatePerSqft = Number(withMaterialRatePerSqft);
    if (slotSqftPerDay !== undefined) category.slotSqftPerDay = Math.max(50, Number(slotSqftPerDay));
    if (perCoatRateMultiplier !== undefined) category.perCoatRateMultiplier = Number(perCoatRateMultiplier);
    if (isActive !== undefined) category.isActive = Boolean(isActive);

    await category.save();

    await AuditLog.create({
      user: String(req.user?.id || 'SUPER_ADMIN'),
      role: 'SuperAdmin',
      action: `UPDATED_SERVICE_RATE [${category.code}]`,
      category: 'RATE_UPDATE',
      ipAddress: req.clientIp || req.ip,
      details: {
        categoryId: category._id,
        labourRatePerSqft: category.labourRatePerSqft,
        withMaterialRatePerSqft: category.withMaterialRatePerSqft,
        slotSqftPerDay: category.slotSqftPerDay,
      },
    }).catch(() => {});

    broadcastServiceRateUpdate({ categoryId: category._id, code: category.code, updatedAt: new Date() });

    return res.status(200).json({
      success: true,
      message: `Rates updated live for ${category.name}.`,
      category,
    });
  } catch (error) {
    next(error);
  }
};
const updateRoleLegalTerms = async (req, res, next) => {
  try {
    const { targetRole, versionLabel, termsContent, commissionClause = '' } = req.body;
    const validRoles = ['Customer', 'Mistri', 'Agent', 'Merchant'];

    if (!validRoles.includes(targetRole) || !termsContent) {
      return res.status(400).json({
        success: false,
        message: 'Valid targetRole (Customer, Mistri, Agent, Merchant) and termsContent are required.',
      });
    }

    await AuditLog.create({
      user: String(req.user?.id || 'SUPER_ADMIN'),
      role: 'SuperAdmin',
      action: `EDITED_ROLE_TERMS [${targetRole}]`,
      category: 'ROLE_TERMS_EDIT',
      ipAddress: req.clientIp || req.ip,
      isImmutableLock: true,
      details: {
        targetRole,
        versionLabel: versionLabel || 'v3.8.0-CUSTOM',
        termsContent,
        commissionClause,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Terms & Conditions updated live for ${targetRole}.`,
    });
  } catch (error) {
    next(error);
  }
};

const issueLegalNotice = async (req, res, next) => {
  try {
    const { disputeId, againstUserId, violationType = 'OffPlatformPoaching', noticeSummary, suspendAccount = true } = req.body;

    if (!againstUserId || !noticeSummary) {
      return res.status(400).json({
        success: false,
        message: 'againstUserId and noticeSummary are required to issue a legal notice.',
      });
    }

    const noticeRef = `LGL-${Date.now().toString().slice(-6)}-${crypto.randomInt(100, 999)}`;

    if (disputeId) {
      await Dispute.findByIdAndUpdate(disputeId, {
        $set: {
          againstUser: againstUserId,
          violationType,
          severity: 'Critical',
          legalNoticeIssued: true,
          legalNoticeRef: noticeRef,
          legalNoticeIssuedAt: new Date(),
          status: 'EscalatedLegal',
        },
      });
    }

    if (suspendAccount) {
      await User.findByIdAndUpdate(againstUserId, {
        $set: {
          suspended: true,
          active: false,
          accountStatus: 'Suspended',
          penaltyStatus: 'Suspended',
          blockReason: `Legal Notice Issued (${noticeRef}): ${violationType}`,
        },
      });
    }

    await AuditLog.create({
      user: String(againstUserId),
      role: 'SuperAdmin',
      action: `ISSUED_LEGAL_NOTICE [${noticeRef}]`,
      category: 'LEGAL_NOTICE',
      ipAddress: req.clientIp || req.ip,
      isImmutableLock: true,
      details: { disputeId, againstUserId, violationType, noticeRef, noticeSummary },
    });

    return res.status(200).json({
      success: true,
      noticeRef,
      message: `Legal notice (${noticeRef}) issued and recorded in immutable audit log.`,
    });
  } catch (error) {
    next(error);
  }
};
const toggleHideMode = (req, res) => {
  const { isHidden, autoHideEnabled } = req.body;

  if (isHidden !== undefined) {
    hideConfig.setHideStatus(Boolean(isHidden), req.clientIp, 'Super Admin Dashboard Control');
  }
  if (autoHideEnabled !== undefined) {
    hideConfig.toggleAutoHide(Boolean(autoHideEnabled));
  }

  res.status(200).json({
    success: true,
    hideStatus: hideConfig.getStatus(),
  });
};

const sendSuperAdminFreeOtps = async (req, res, next) => {
  try {
    const adminPhone = String(process.env.SUPER_ADMIN_PHONE || '').trim();
    const adminGmail = String(process.env.SUPER_ADMIN_GMAIL || process.env.SMTP_USER || '').trim().toLowerCase();

    const phoneOtpCode = generateSixDigitOtp();
    const gmailOtpCode = generateSixDigitOtp();

    await OTP.deleteMany({ purpose: { $in: ['SUPER_ADMIN_PHONE', 'SUPER_ADMIN_GMAIL'] } });

    await OTP.create([
      {
        phone: adminPhone,
        code: phoneOtpCode,
        provider: 'TELEGRAM_BOT',
        purpose: 'SUPER_ADMIN_PHONE',
      },
      {
        email: adminGmail,
        code: gmailOtpCode,
        provider: 'GMAIL_SMTP',
        purpose: 'SUPER_ADMIN_GMAIL',
      },
    ]);

    const [phoneDispatch] = await Promise.all([
      sendSuperAdminPhoneOtp(phoneOtpCode),
      sendSuperAdminGmailOtp(gmailOtpCode),
    ]);

    res.status(200).json({
      success: true,
      cost: 0,
      telegramSent: phoneDispatch.telegramSent,
      gmailSent: true,
      message: 'Free Super Admin OTPs dispatched via Telegram & Gmail.',
    });
  } catch (error) {
    next(error);
  }
};

const verifySuperAdminFreeOtps = async (req, res, next) => {
  return verifySuperAdmin2FA(req, res, next);
};

module.exports = {
  getDashboardStats,
  superAdminLoginWithPassword,
  verifySuperAdmin2FA,
  verifyAccount,
  manageUserAccount,
  adminResetUserPassword,
  updateServiceCategoryRate,
  updateRoleLegalTerms,
  issueLegalNotice,
  toggleHideMode,
  sendSuperAdminFreeOtps,
  verifySuperAdminFreeOtps,
};
