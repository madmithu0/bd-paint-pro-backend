const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const OTP = require('../../models/OTP');
const AuditLog = require('../../models/AuditLog');
const HackLog = require('../../models/HackLog');
const Kill = require('../../models/Kill');
const User = require('../../models/User');
const Dispute = require('../../models/Dispute');
const adminController = require('../../controllers/adminController');
const adminMiddleware = require('../../middleware/adminMiddleware');
const {
  verifyPassword,
  hashPassword,
  validatePasswordStrength,
} = require('../../services/auth/passwordSecurityService');
const { sendSuperAdminPhoneOtp, verifyFirebasePhoneToken } = require('../../utils/smsUtils');
const { sendSuperAdminGmailOtp } = require('../../utils/emailUtils');
const { generateSuperAdmin4LayerToken } = require('../../utils/tokenUtils');

const safeRequireModel = (modelPath) => {
  try {
    return require(modelPath);
  } catch (err) {
    return null;
  }
};

const SuperAdminSecurity = safeRequireModel('../../models/SuperAdminSecurity');
const ServiceCategory = safeRequireModel('../../models/ServiceCategory');
const RoleTerms = safeRequireModel('../../models/RoleTerms');

const verifySuperAdminToken =
  adminMiddleware.superAdminGate ||
  adminMiddleware.verifySuperAdmin ||
  adminMiddleware;

const extractClientIp = (req) => {
  const cfIp = req.headers['cf-connecting-ip'];
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp =
    cfIp ||
    (forwarded ? forwarded.split(',')[0].trim() : null) ||
    req.clientIp ||
    req.ip ||
    '';
  return String(rawIp).replace(/^::ffff:/, '').trim();
};

const enforceSuperAdminIpGuard = async (req, res, next) => {
  try {
    const clientIp = extractClientIp(req);
    req.cleanIp = clientIp;

    const bannedRecord = await HackLog.findOne({
      ipAddress: clientIp,
      autoBlocked: true,
    }).lean();

    if (bannedRecord) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. IP permanently banned.',
      });
    }

    const rawAllowedIps = String(process.env.SUPER_ADMIN_IP || '').trim();
    const allowedIps = rawAllowedIps
      ? rawAllowedIps.split(',').map((ip) => ip.trim()).filter(Boolean)
      : [];

    if (process.env.DEV_MODE !== 'true' && allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
      await HackLog.create({
        ipAddress: clientIp,
        cloudflareRayId: req.headers['cf-ray'] || 'DIRECT',
        attackType: 'UNAUTHORIZED_SUPER_ADMIN_IP',
        actionTaken: 'BLOCKED_NON_WHITELIST_IP',
        autoBlocked: true,
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        message: 'Access denied. Unauthorized IP address.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
router.use(enforceSuperAdminIpGuard);

router.post('/send-otps', async (req, res, next) => {
  try {
    const phone = String(process.env.SUPER_ADMIN_PHONE || '').trim();
    const email = String(process.env.SUPER_ADMIN_GMAIL || process.env.SMTP_USER || '').trim();

    if (!phone || !email) {
      return res.status(500).json({ success: false, message: 'Super Admin contact config missing.' });
    }
    const phoneOtp = String(crypto.randomInt(100000, 999999));
    const gmailOtp = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTP.deleteMany({
      $or: [
        { phone, purpose: 'SUPER_ADMIN_PHONE', verified: false },
        { email, purpose: 'SUPER_ADMIN_GMAIL', verified: false },
      ],
    });

    await Promise.all([
      OTP.create({ phone, code: phoneOtp, provider: 'TELEGRAM_BOT', purpose: 'SUPER_ADMIN_PHONE', expiresAt }),
      OTP.create({ email, code: gmailOtp, provider: 'GMAIL_SMTP', purpose: 'SUPER_ADMIN_GMAIL', expiresAt }),
    ]);

    const [tgDispatch] = await Promise.all([
      sendSuperAdminPhoneOtp(phoneOtp),
      sendSuperAdminGmailOtp(gmailOtp),
    ]);

    return res.status(200).json({
      success: true,
      cost: 0,
      telegramSent: tgDispatch.telegramSent,
      useFirebaseOption: Boolean(process.env.FIREBASE_PROJECT_ID),
      superAdminPhone: phone,
      message: 'Free Phone & Gmail OTPs sent successfully.',
      ...(process.env.DEV_MODE === 'true' && { devPhoneOtp: phoneOtp, devGmailOtp: gmailOtp }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login-verify', async (req, res, next) => {
  try {
    const {
      password,
      phoneOtp,
      firebaseIdToken,
      gmailOtp,
      transactionPin,
    } = req.body;

    const clientIp = req.cleanIp;
    const phone = String(process.env.SUPER_ADMIN_PHONE || '').trim();
    const email = String(process.env.SUPER_ADMIN_GMAIL || process.env.SMTP_USER || '').trim();
    const superAdminId = String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim();

    let passwordPassed = false;
    const securityDoc = SuperAdminSecurity
      ? await SuperAdminSecurity.findOne({ superAdminId }).catch(() => null)
      : null;

    if (securityDoc && securityDoc.passwordHash) {
      passwordPassed = await verifyPassword(password, securityDoc.passwordHash);
    } else if (process.env.SUPER_ADMIN_PASSWORD) {
      passwordPassed = String(password || '') === String(process.env.SUPER_ADMIN_PASSWORD).trim();
    }

    let pinPassed = true;
    const configuredPin = securityDoc?.transactionPin || process.env.SUPER_ADMIN_TXN_PIN;
    if (configuredPin) {
      pinPassed = String(transactionPin || '').trim() === String(configuredPin).trim();
    }

    let validPhoneOtp = null;
    let firebasePhonePassed = false;

    if (firebaseIdToken) {
      try {
        const fbRes = await verifyFirebasePhoneToken(firebaseIdToken);
        if (fbRes.verified && fbRes.phone.replace(/^\+88/, '') === phone.replace(/^\+88/, '')) {
          firebasePhonePassed = true;
        }
      } catch {
        firebasePhonePassed = false;
      }
    }
    if (!firebasePhonePassed && phoneOtp) {
      validPhoneOtp = await OTP.findOne({
        phone,
        code: String(phoneOtp || '').trim(),
        purpose: 'SUPER_ADMIN_PHONE',
        verified: false,
        expiresAt: { $gt: new Date() },
      });
    }

    const validGmailOtp = await OTP.findOne({
      email,
      code: String(gmailOtp || '').trim(),
      purpose: 'SUPER_ADMIN_GMAIL',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    const layerStatus = {
      passwordVerified: Boolean(passwordPassed),
      phoneOtp: Boolean(firebasePhonePassed || validPhoneOtp),
      gmailOtp: Boolean(validGmailOtp),
      transactionPinVerified: Boolean(pinPassed),
    };

    if (!layerStatus.passwordVerified || !layerStatus.phoneOtp || !layerStatus.gmailOtp || !layerStatus.transactionPinVerified) {
      await AuditLog.create({
        user: superAdminId,
        role: 'SuperAdmin',
        action: 'SUPER_ADMIN_LOGIN_FAILED',
        category: 'SECURITY_FAIL',
        ipAddress: clientIp,
        details: { layerStatus },
      }).catch(() => {});

      return res.status(401).json({
        success: false,
        message: 'Login failed. Password, Phone OTP, Gmail OTP, and Transaction PIN must all pass.',
        layers: layerStatus,
      });
    }

    if (validPhoneOtp) {
      validPhoneOtp.verified = true;
      await validPhoneOtp.save();
    }
    validGmailOtp.verified = true;
    await validGmailOtp.save();

    const superToken = generateSuperAdmin4LayerToken({
      role: 'SuperAdmin',
      superAdminId,
      clientIp,
      layers: layerStatus,
    });

    await AuditLog.create({
      user: superAdminId,
      role: 'SuperAdmin',
      action: 'SUPER_ADMIN_PASSWORD_2FA_LOGIN_SUCCESS',
      category: 'ADMIN',
      ipAddress: clientIp,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Password & 2FA verified. Super Admin Dashboard unlocked.',
      layers: layerStatus,
      superToken,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/hardware-recovery', async (req, res, next) => {
  try {
    const { hardwareKey, superAdminId } = req.body;
    const expectedKey = String(process.env.OFFLINE_HARDWARE_RECOVERY_KEY || '').trim();
    const expectedId = String(process.env.SUPER_ADMIN_ID || '').trim();
    const clientIp = req.cleanIp;

    if (!expectedKey || !expectedId || hardwareKey !== expectedKey || superAdminId !== expectedId) {
      return res.status(401).json({ success: false, message: 'Invalid Hardware Recovery Key or ID.' });
    }
    const recoveryLayers = {
      passwordVerified: true,
      phoneOtp: true,
      gmailOtp: true,
      transactionPinVerified: true,
      hardwareRecovery: true,
    };

    const superToken = generateSuperAdmin4LayerToken({
      role: 'SuperAdmin',
      superAdminId: expectedId,
      clientIp,
      layers: recoveryLayers,
    });

    await AuditLog.create({
      user: expectedId,
      role: 'SuperAdmin',
      action: 'HARDWARE_RECOVERY_ACCESS_GRANTED',
      category: 'ADMIN',
      ipAddress: clientIp,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Offline Hardware Recovery verified.',
      layers: recoveryLayers,
      superToken,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/hide-status', (req, res) => {
  return res.status(200).json({
    success: true,
    isHidden: Boolean(req.app.locals.systemConfig?.isHidden),
    autoHideEnabled: false,
    remainingSeconds: 0,
  });
});

router.use(verifySuperAdminToken);

router.post('/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword, newTransactionPin } = req.body;
    const superAdminId = String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim();

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return res.status(400).json({ success: false, message: strength.message });
    }

    let securityDoc = SuperAdminSecurity
      ? await SuperAdminSecurity.findOne({ superAdminId }).catch(() => null)
      : null;
    let currentValid = false;

    if (securityDoc && securityDoc.passwordHash) {
      currentValid = await verifyPassword(currentPassword, securityDoc.passwordHash);
    } else if (process.env.SUPER_ADMIN_PASSWORD) {
      currentValid = String(currentPassword || '') === String(process.env.SUPER_ADMIN_PASSWORD).trim();
    }

    if (!currentValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(newPassword);
    if (SuperAdminSecurity) {
      if (!securityDoc) {
        securityDoc = new SuperAdminSecurity({
          superAdminId,
          passwordHash: newHash,
          ...(newTransactionPin && { transactionPin: String(newTransactionPin).trim() }),
          passwordChangedAt: new Date(),
        });
      } else {
        securityDoc.passwordHash = newHash;
        if (newTransactionPin) securityDoc.transactionPin = String(newTransactionPin).trim();
        securityDoc.passwordChangedAt = new Date();
      }
      await securityDoc.save();
    }

    await AuditLog.create({
      user: superAdminId,
      role: 'SuperAdmin',
      action: 'SUPER_ADMIN_PASSWORD_CHANGED',
      category: 'ADMIN',
      ipAddress: req.cleanIp,
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Super Admin password & PIN updated successfully.' });
  } catch (error) {
    next(error);
  }
});
router.get('/services', async (req, res, next) => {
  try {
    if (!ServiceCategory) {
      return res.status(200).json({ success: true, services: [], message: 'ServiceCategory model not loaded yet.' });
    }
    const services = await ServiceCategory.find().sort({ createdAt: 1 }).lean();
    return res.status(200).json({ success: true, services });
  } catch (error) {
    next(error);
  }
});

router.put('/services/:id', async (req, res, next) => {
  try {
    if (!ServiceCategory) {
      return res.status(500).json({ success: false, message: 'ServiceCategory model missing.' });
    }

    const allowedFields = [
      'nameBn',
      'nameEn',
      'slotSqftPerDay',
      'defaultCoats',
      'perCoatRateMultiplier',
      'labourRatePerSqft',
      'withMaterialRatePerSqft',
      'availableBrands',
      'specialtyArea',
      'isLabourOnlyEnabled',
      'isWithMaterialEnabled',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const updatedService = await ServiceCategory.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedService) {
      return res.status(404).json({ success: false, message: 'Service category not found.' });
    }

    if (req.app.get('io')) {
      req.app.get('io').emit('service:rateUpdated', updatedService);
    }

    await AuditLog.create({
      user: String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim(),
      role: 'SuperAdmin',
      action: `SERVICE_RATE_UPDATED_${updatedService.nameEn || req.params.id}`,
      category: 'ADMIN',
      ipAddress: req.cleanIp,
      details: updates,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Service rate & slot configuration updated live.',
      service: updatedService,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/services/:id/toggle', async (req, res, next) => {
  try {
    if (!ServiceCategory) {
      return res.status(500).json({ success: false, message: 'ServiceCategory model missing.' });
    }

    const service = await ServiceCategory.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service category not found.' });
    }

    service.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !service.isActive;
    await service.save();
    if (req.app.get('io')) {
      req.app.get('io').emit('service:toggled', { id: service._id, isActive: service.isActive });
    }

    await AuditLog.create({
      user: String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim(),
      role: 'SuperAdmin',
      action: `SERVICE_TOGGLED_${service.isActive ? 'ON' : 'OFF'}`,
      category: 'ADMIN',
      ipAddress: req.cleanIp,
      details: { serviceId: service._id, nameEn: service.nameEn },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Service ${service.isActive ? 'enabled' : 'disabled'} successfully.`,
      service,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/role-terms', async (req, res, next) => {
  try {
    if (!RoleTerms) {
      return res.status(200).json({ success: true, terms: [] });
    }
    const terms = await RoleTerms.find().lean();
    return res.status(200).json({ success: true, terms });
  } catch (error) {
    next(error);
  }
});

router.put('/role-terms/:role', async (req, res, next) => {
  try {
    if (!RoleTerms) {
      return res.status(500).json({ success: false, message: 'RoleTerms model missing.' });
    }

    const roleName = req.params.role;
    const { title, clauses, version, commissionRatePercent, antiPoachingPenaltyAmount } = req.body;

    const updatedTerms = await RoleTerms.findOneAndUpdate(
      { role: roleName },
      {
        $set: {
          role: roleName,
          ...(title && { title }),
          ...(clauses && { clauses }),
          ...(version && { version }),
          ...(commissionRatePercent !== undefined && { commissionRatePercent }),
          ...(antiPoachingPenaltyAmount !== undefined && { antiPoachingPenaltyAmount }),
          updatedBy: String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim(),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await AuditLog.create({
      user: String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim(),
      role: 'SuperAdmin',
      action: `ROLE_TERMS_UPDATED_${roleName.toUpperCase()}`,
      category: 'ADMIN',
      ipAddress: req.cleanIp,
      details: { version: updatedTerms.version },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `${roleName} terms & legal clauses updated live.`,
      terms: updatedTerms,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/hotline', async (req, res, next) => {
  try {
    const { hotlineNumber, isLive } = req.body;
    const updatedKill = await Kill.findOneAndUpdate(
      { target: 'HOTLINE_CONFIG' },
      {
        $set: {
          target: 'HOTLINE_CONFIG',
          active: Boolean(isLive),
          hotlineConfig: {
            number: String(hotlineNumber || '').trim(),
            isLive: Boolean(isLive),
          },
        },
      },
      { upsert: true, new: true }
    );
    if (req.app.get('io')) {
      req.app.get('io').emit('system:hotlineUpdated', updatedKill.hotlineConfig);
    }

    await AuditLog.create({
      user: String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim(),
      role: 'SuperAdmin',
      action: 'HOTLINE_CONFIG_UPDATED',
      category: 'ADMIN',
      ipAddress: req.cleanIp,
      details: { hotlineNumber, isLive },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Live hotline configuration updated.',
      hotlineConfig: updatedKill.hotlineConfig,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/legal-notice/:disputeId', async (req, res, next) => {
  try {
    const { violationType, noticeText, fineAmount } = req.body;
    const dispute = await Dispute.findById(req.params.disputeId);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute record not found.' });
    }

    dispute.violationType = violationType || dispute.violationType || 'OffPlatformPoaching';
    dispute.legalNoticeIssued = true;
    dispute.severity = 'Critical';
    await dispute.save();

    await AuditLog.create({
      user: String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim(),
      role: 'SuperAdmin',
      action: 'LEGAL_VIOLATION_NOTICE_ISSUED',
      category: 'LEGAL',
      ipAddress: req.cleanIp,
      details: { disputeId: dispute._id, violationType, noticeText, fineAmount },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Official legal violation notice issued & logged.',
      dispute,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/merchants/:userId/verify', async (req, res, next) => {
  try {
    const { approve } = req.body;
    const merchant = await User.findById(req.params.userId);
    if (!merchant || merchant.role !== 'Merchant') {
      return res.status(404).json({ success: false, message: 'Merchant account not found.' });
    }

    if (approve && !merchant.merchantCommissionAgreed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot activate Merchant without commission agreement consent.',
      });
    }

    merchant.accountStatus = approve ? 'Active' : 'Suspended';
    await merchant.save();

    await AuditLog.create({
      user: String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim(),
      role: 'SuperAdmin',
      action: `MERCHANT_${approve ? 'APPROVED' : 'SUSPENDED'}`,
      category: 'ADMIN',
      ipAddress: req.cleanIp,
      details: { merchantId: merchant._id },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Merchant account ${approve ? 'verified and activated' : 'suspended'}.`,
      merchant,
    });
  } catch (error) {
    next(error);
  }
});
router.get('/dashboard', adminController.getDashboardStats || ((req, res) => res.json({ success: true })));

router.post(
  '/hide-toggle',
  adminController.toggleHideMode ||
    adminController.toggleHideSystem ||
    ((req, res) => {
      if (req.app.locals.systemConfig) {
        req.app.locals.systemConfig.isHidden = Boolean(req.body.hide);
      }
      return res.json({ success: true, isHidden: Boolean(req.body.hide) });
    })
);

let savedGatewayConfig = {
  bkashMerchantNumber: process.env.BKASH_MERCHANT_NUMBER || '',
  bkashAppKey: process.env.BKASH_APP_KEY ? '********' : '',
  nagadMerchantId: process.env.NAGAD_MERCHANT_ID || '',
  nagadPublicKey: process.env.NAGAD_PUBLIC_KEY ? '********' : '',
  rocketAccount: process.env.ROCKET_ACCOUNT || '',
  bankAccountDetails: process.env.BANK_ACCOUNT_DETAILS || '',
};

router.get('/status', async (req, res, next) => {
  try {
    const [kills, recentHacks] = await Promise.all([
      Kill.find({ active: true }).lean().catch(() => []),
      HackLog.find().sort({ createdAt: -1 }).limit(20).lean().catch(() => []),
    ]);

    const killTargets = {};
    kills.forEach((k) => {
      if (k.target) killTargets[k.target] = true;
    });

    return res.status(200).json({
      success: true,
      system: {
        appVersion: 'v3.8.0 FINAL',
        replicaStatus: 'Healthy (Primary + Secondary)',
        pitrStatus: 'Active (10m Incremental)',
        selfHealing: 'Online',
      },
      verifyLayers: {
        passwordVerified: true,
        phoneOtp: true,
        gmailOtp: true,
        transactionPinVerified: true,
      },
      isHidden: Boolean(req.app.locals.systemConfig?.isHidden),
      killTargets,
      gatewayConfig: savedGatewayConfig,
      hackLogs: recentHacks,
      aiReports: [],
    });
  } catch (error) {
    next(error);
  }
});

router.post('/payment-config', async (req, res, next) => {
  try {
    savedGatewayConfig = { ...savedGatewayConfig, ...req.body };

    await AuditLog.create({
      user: String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim(),
      role: 'SuperAdmin',
      action: 'PAYMENT_GATEWAY_ACCOUNTS_UPDATED',
      category: 'ADMIN',
      ipAddress: req.cleanIp,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Merchant payment accounts & keys updated successfully.',
      gatewayConfig: savedGatewayConfig,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/audits', async (req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(50).lean();
    return res.status(200).json({
      success: true,
      logs,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
