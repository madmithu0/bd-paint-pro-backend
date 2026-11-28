const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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
const { sendSuperAdminPhoneOtp } = require('../../utils/smsUtils');
const { sendSuperAdminGmailOtp } = require('../../utils/emailUtils');
const { generateSuperAdmin4LayerToken } = require('../../utils/tokenUtils');

const safeRequireModel = (modelPath) => {
  try {
    return require(modelPath);
  } catch {
    return null;
  }
};

const SuperAdminSecurity = safeRequireModel('../../models/SuperAdminSecurity');
const ServiceCategory = safeRequireModel('../../models/ServiceCategory');
const RoleTerms = safeRequireModel('../../models/RoleTerms');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_v380_key';

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

    const securityDoc = SuperAdminSecurity
      ? await SuperAdminSecurity.findOne().lean().catch(() => null)
      : null;

    const dbIps = Array.isArray(securityDoc?.allowedIps) ? securityDoc.allowedIps : [];
    const envIps = String(process.env.SUPER_ADMIN_IP || '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

    const allowedIps = dbIps.length > 0 ? dbIps : envIps;

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

router.post('/login-password', async (req, res, next) => {
  try {
    const { superAdminId, password } = req.body;
    const expectedId = String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim();
    const clientIp = req.cleanIp;

    if (String(superAdminId || '').trim() !== expectedId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Super Admin Master ID.',
      });
    }

    let passwordPassed = false;
    const securityDoc = SuperAdminSecurity
      ? await SuperAdminSecurity.findOne({ superAdminId: expectedId }).catch(() => null)
      : null;

    if (securityDoc && securityDoc.passwordHash) {
      passwordPassed = await verifyPassword(password, securityDoc.passwordHash);
    } else if (process.env.SUPER_ADMIN_PASSWORD) {
      passwordPassed = String(password || '') === String(process.env.SUPER_ADMIN_PASSWORD).trim();
    }

    if (!passwordPassed) {
      await AuditLog.create({
        user: expectedId,
        role: 'SuperAdmin',
        action: 'PASSWORD_VERIFY_FAILED',
        category: 'SECURITY_FAIL',
        ipAddress: clientIp,
      }).catch(() => {});

      return res.status(401).json({
        success: false,
        message: 'Invalid Master Password.',
      });
    }

    const phone = String(process.env.SUPER_ADMIN_PHONE || '').trim();
    const email = String(process.env.SUPER_ADMIN_GMAIL || process.env.SMTP_USER || '').trim();

    if (securityDoc && securityDoc.twoFactorEnabled === false) {
      const token = generateSuperAdmin4LayerToken({
        role: 'SuperAdmin',
        superAdminId: expectedId,
        clientIp,
        layers: { passwordVerified: true, phoneOtp: true, gmailOtp: true },
      });
      return res.status(200).json({ success: true, token });
    }

    if (!phone || !email) {
      return res.status(500).json({
        success: false,
        message: 'Super Admin Phone or Gmail config missing on server.',
      });
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

    await Promise.all([
      sendSuperAdminPhoneOtp(phoneOtp).catch(() => {}),
      sendSuperAdminGmailOtp(gmailOtp).catch(() => {}),
    ]);

    const challengeToken = jwt.sign(
      { superAdminId: expectedId, clientIp, step: '2FA_PENDING' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    return res.status(200).json({
      success: true,
      challengeToken,
      message: 'Password verified. 6-digit OTPs sent to Phone & Gmail.',
      ...(process.env.DEV_MODE === 'true' && { devPhoneOtp: phoneOtp, devGmailOtp: gmailOtp }),
    });
  } catch (error) {
    next(error);
  }
});
router.post('/verify-2fa', async (req, res, next) => {
  try {
    const { challengeToken, phoneOtp, gmailOtp } = req.body;
    const clientIp = req.cleanIp;

    if (!challengeToken) {
      return res.status(400).json({
        success: false,
        message: 'Session challenge token missing. Start login again.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(challengeToken, JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: '2FA session expired. Please verify password again.',
      });
    }

    const superAdminId = decoded.superAdminId || String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim();
    const phone = String(process.env.SUPER_ADMIN_PHONE || '').trim();
    const email = String(process.env.SUPER_ADMIN_GMAIL || process.env.SMTP_USER || '').trim();

    const [validPhoneOtp, validGmailOtp] = await Promise.all([
      OTP.findOne({
        phone,
        code: String(phoneOtp || '').trim(),
        purpose: 'SUPER_ADMIN_PHONE',
        verified: false,
        expiresAt: { $gt: new Date() },
      }),
      OTP.findOne({
        email,
        code: String(gmailOtp || '').trim(),
        purpose: 'SUPER_ADMIN_GMAIL',
        verified: false,
        expiresAt: { $gt: new Date() },
      }),
    ]);

    if (!validPhoneOtp || !validGmailOtp) {
      await AuditLog.create({
        user: superAdminId,
        role: 'SuperAdmin',
        action: '2FA_OTP_VERIFY_FAILED',
        category: 'SECURITY_FAIL',
        ipAddress: clientIp,
      }).catch(() => {});

      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Phone OTP or Gmail OTP.',
      });
    }

    validPhoneOtp.verified = true;
    validGmailOtp.verified = true;
    await Promise.all([validPhoneOtp.save(), validGmailOtp.save()]);

    if (SuperAdminSecurity) {
      await SuperAdminSecurity.findOneAndUpdate(
        { superAdminId },
        { $set: { lastLoginIp: clientIp, failedAttempts: 0 } }
      ).catch(() => {});
    }

    const token = generateSuperAdmin4LayerToken({
      role: 'SuperAdmin',
      superAdminId,
      clientIp,
      layers: { passwordVerified: true, phoneOtp: true, gmailOtp: true },
    });

    await AuditLog.create({
      user: superAdminId,
      role: 'SuperAdmin',
      action: 'SUPER_ADMIN_2FA_LOGIN_SUCCESS',
      category: 'ADMIN',
      ipAddress: clientIp,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: '2FA verified. Super Admin Dashboard unlocked.',
      token,
      superToken: token,
    });
  } catch (error) {
    next(error);
  }
});

router.use(verifySuperAdminToken);

router.get('/dashboard-status', async (req, res, next) => {
  try {
    const hotlineDoc = await Kill.findOne({ target: 'HOTLINE_CONFIG' }).lean().catch(() => null);
    return res.status(200).json({
      success: true,
      data: {
        appVersion: 'v3.8.0 ENTERPRISE FINAL',
        netProfit: 0,
        merchantCommission: 0,
        hotlineNumber: hotlineDoc?.hotlineConfig?.number || '+8801700000000',
        hotlineStatus: hotlineDoc?.active ? 'ACTIVE' : 'STANDBY',
        dialectAiHealth: '98.4% OPTIMAL',
        systemUptime: '99.98%',
      },
    });
  } catch (error) {
    next(error);
  }
});
router.get('/security-config', async (req, res, next) => {
  try {
    const superAdminId = String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim();
    const securityDoc = SuperAdminSecurity
      ? await SuperAdminSecurity.findOne({ superAdminId }).lean().catch(() => null)
      : null;

    return res.status(200).json({
      success: true,
      data: {
        allowedIps: securityDoc?.allowedIps || [],
        sessionTimeoutMinutes: securityDoc?.sessionTimeoutMinutes || 30,
        twoFactorEnabled: securityDoc?.twoFactorEnabled !== false,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/security-config', async (req, res, next) => {
  try {
    const superAdminId = String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim();
    const { allowedIps, sessionTimeoutMinutes, twoFactorEnabled } = req.body;

    if (SuperAdminSecurity) {
      await SuperAdminSecurity.findOneAndUpdate(
        { superAdminId },
        {
          $set: {
            ...(Array.isArray(allowedIps) && { allowedIps }),
            ...(sessionTimeoutMinutes !== undefined && {
              sessionTimeoutMinutes: Number(sessionTimeoutMinutes),
            }),
            ...(twoFactorEnabled !== undefined && {
              twoFactorEnabled: Boolean(twoFactorEnabled),
            }),
          },
        },
        { upsert: true, new: true }
      );
    }

    await AuditLog.create({
      user: superAdminId,
      role: 'SuperAdmin',
      action: 'SECURITY_POLICY_UPDATED',
      category: 'ADMIN',
      ipAddress: req.cleanIp,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Security & IP whitelist settings saved.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/update-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
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
      await SuperAdminSecurity.findOneAndUpdate(
        { superAdminId },
        { $set: { passwordHash: newHash, passwordChangedAt: new Date() } },
        { upsert: true }
      );
    }

    await AuditLog.create({
      user: superAdminId,
      role: 'SuperAdmin',
      action: 'SUPER_ADMIN_PASSWORD_CHANGED',
      category: 'ADMIN',
      ipAddress: req.cleanIp,
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Master Password updated successfully.' });
  } catch (error) {
    next(error);
  }
});
router.post('/update-transaction-pin', async (req, res, next) => {
  try {
    const { currentPassword, newTransactionPin } = req.body;
    const superAdminId = String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim();

    if (!/^\d{6}$/.test(String(newTransactionPin || '').trim())) {
      return res.status(400).json({ success: false, message: 'Transaction PIN must be 6 digits.' });
    }

    const securityDoc = SuperAdminSecurity
      ? await SuperAdminSecurity.findOne({ superAdminId }).catch(() => null)
      : null;

    let currentValid = false;
    if (securityDoc && securityDoc.passwordHash) {
      currentValid = await verifyPassword(currentPassword, securityDoc.passwordHash);
    } else if (process.env.SUPER_ADMIN_PASSWORD) {
      currentValid = String(currentPassword || '') === String(process.env.SUPER_ADMIN_PASSWORD).trim();
    }

    if (!currentValid) {
      return res.status(401).json({ success: false, message: 'Master password verification failed.' });
    }

    if (SuperAdminSecurity) {
      await SuperAdminSecurity.findOneAndUpdate(
        { superAdminId },
        { $set: { transactionPin: String(newTransactionPin).trim() } },
        { upsert: true }
      );
    }

    await AuditLog.create({
      user: superAdminId,
      role: 'SuperAdmin',
      action: 'TRANSACTION_PIN_UPDATED',
      category: 'ADMIN',
      ipAddress: req.cleanIp,
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Transaction PIN updated successfully.' });
  } catch (error) {
    next(error);
  }
});

router.get('/auth-security-logs', async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ role: 'SuperAdmin' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const formatted = logs.map((item) => ({
      _id: item._id,
      createdAt: item.createdAt,
      eventType: item.action,
      ipAddress: item.ipAddress || 'Unknown',
      userAgent: item.details?.userAgent || 'Enterprise Client',
      status: item.category === 'SECURITY_FAIL' ? 'FAIL' : 'PASS',
    }));

    return res.status(200).json({ success: true, logs: formatted });
  } catch (error) {
    next(error);
  }
});

router.get('/services', async (req, res, next) => {
  try {
    if (!ServiceCategory) {
      return res.status(200).json({ success: true, services: [] });
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

router.get('/audits', async (req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(50).lean();
    return res.status(200).json({ success: true, logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
