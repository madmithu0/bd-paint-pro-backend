const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const OTP = require('../../models/OTP');
const AuditLog = require('../../models/AuditLog');
const HackLog = require('../../models/HackLog');
const adminController = require('../../controllers/adminController');
const adminMiddleware = require('../../middleware/adminMiddleware');
const { sendSuperAdminPhoneOtp } = require('../../utils/smsUtils');
const { sendSuperAdminGmailOtp } = require('../../utils/emailUtils');
const { generateSuperAdmin4LayerToken } = require('../../utils/tokenUtils');
const { verifyVoiceBiometric } = require('../../services/biometric/voiceVerify');
const { verifyFace3DBiometric } = require('../../services/biometric/face3DVerify');

const verifySuperAdminToken =
  adminMiddleware.superAdminGate ||
  adminMiddleware.verifySuperAdmin ||
  adminMiddleware;

const extractClientIp = (req) => {
  const cfIp = req.headers['cf-connecting-ip'];
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = cfIp || (forwarded ? forwarded.split(',')[0].trim() : null) || req.clientIp || req.ip || '';
  return String(rawIp).replace(/^::ffff:/, '');
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

    const allowedIp = String(process.env.SUPER_ADMIN_IP || '').trim();
    if (process.env.DEV_MODE !== 'true' && allowedIp && clientIp !== allowedIp) {
      await HackLog.create({
        ipAddress: clientIp,
        cloudflareRayId: req.headers['cf-ray'] || 'DIRECT',
        attackType: 'UNAUTHORIZED_SUPER_ADMIN_IP',
        actionTaken: 'BLOCKED_NON_WHITELIST_IP',
        autoBlocked: true,
      });

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

// @route   POST /api/v1/x9-super-2026/send-otps
// @desc    Dispatch Layer-1 Phone OTP and Layer-2 Gmail OTP
router.post('/send-otps', async (req, res, next) => {
  try {
    const phone = String(process.env.SUPER_ADMIN_PHONE || '').trim();
    const email = String(process.env.SUPER_ADMIN_GMAIL || '').trim();

    if (!phone || !email) {
      return res.status(500).json({
        success: false,
        message: 'Super Admin contact configuration missing on server.',
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
      OTP.create({
        phone,
        code: phoneOtp,
        purpose: 'SUPER_ADMIN_PHONE',
        expiresAt,
      }),
      OTP.create({
        email,
        code: gmailOtp,
        purpose: 'SUPER_ADMIN_GMAIL',
        expiresAt,
      }),
    ]);

    await Promise.all([
      sendSuperAdminPhoneOtp(phoneOtp),
      sendSuperAdminGmailOtp(gmailOtp),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Phone OTP and Gmail OTP sent successfully.',
      ...(process.env.DEV_MODE === 'true' && { devPhoneOtp: phoneOtp, devGmailOtp: gmailOtp }),
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/x9-super-2026/verify-4-layer
// @desc    Verify Phone OTP, Gmail OTP, Live Voice, and Live 3D Face
router.post('/verify-4-layer', async (req, res, next) => {
  try {
    const {
      phoneOtp,
      gmailOtp,
      voiceSampleBase64,
      voiceTranscript,
      faceVideoBase64,
      headMovements,
      eyeBlinkDetected,
    } = req.body;

    const clientIp = req.cleanIp;
    const phone = String(process.env.SUPER_ADMIN_PHONE || '').trim();
    const email = String(process.env.SUPER_ADMIN_GMAIL || '').trim();
    const superAdminId = String(process.env.SUPER_ADMIN_ID || 'SA_2026_MASTER').trim();

    const [validPhoneOtp, validGmailOtp, voiceResult, faceResult] = await Promise.all([
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
      verifyVoiceBiometric({
        voiceSampleBase64,
        transcript: voiceTranscript,
      }),
      verifyFace3DBiometric({
        faceVideoBase64,
        headMovements,
        eyeBlinkDetected,
      }),
    ]);

    const layerStatus = {
      phoneOtp: Boolean(validPhoneOtp),
      gmailOtp: Boolean(validGmailOtp),
      voiceVerified: Boolean(voiceResult && voiceResult.verified),
      face3DVerified: Boolean(faceResult && faceResult.verified),
    };

    if (
      !layerStatus.phoneOtp ||
      !layerStatus.gmailOtp ||
      !layerStatus.voiceVerified ||
      !layerStatus.face3DVerified
    ) {
      await AuditLog.create({
        user: superAdminId,
        role: 'SuperAdmin',
        action: '4_LAYER_BIOMETRIC_VERIFY_FAILED',
        category: 'BIOMETRIC_FAIL',
        ipAddress: clientIp,
        details: {
          layerStatus,
          voiceScore: voiceResult?.score || 0,
          faceScore: faceResult?.score || 0,
        },
      });

      const recentFails = await AuditLog.countDocuments({
        ipAddress: clientIp,
        action: '4_LAYER_BIOMETRIC_VERIFY_FAILED',
        createdAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) },
      });

      if (recentFails >= 3) {
        await HackLog.create({
          ipAddress: clientIp,
          cloudflareRayId: req.headers['cf-ray'] || 'DIRECT',
          attackType: 'SUPER_ADMIN_BRUTE_FORCE',
          actionTaken: 'AUTO_BANNED_AFTER_3_FAILS',
          autoBlocked: true,
        });
      }

      return res.status(401).json({
        success: false,
        message: '4-Layer verification failed. All 4 layers must pass.',
        layers: layerStatus,
        scores: {
          voiceScore: voiceResult?.score || 0,
          faceScore: faceResult?.score || 0,
        },
      });
    }

    validPhoneOtp.verified = true;
    validGmailOtp.verified = true;
    await Promise.all([validPhoneOtp.save(), validGmailOtp.save()]);

    const superToken = generateSuperAdmin4LayerToken({
      superAdminId,
      clientIp,
      layers: layerStatus,
    });

    await AuditLog.create({
      user: superAdminId,
      role: 'SuperAdmin',
      action: '4_LAYER_BIOMETRIC_VERIFY_SUCCESS',
      category: 'ADMIN',
      ipAddress: clientIp,
    });

    return res.status(200).json({
      success: true,
      message: 'All 4 security layers verified. Dashboard unlocked.',
      layers: layerStatus,
      superToken,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/x9-super-2026/hardware-recovery
// @desc    Offline Hardware Recovery Key fallback
router.post('/hardware-recovery', async (req, res, next) => {
  try {
    const { hardwareKey, superAdminId } = req.body;
    const expectedKey = String(process.env.OFFLINE_HARDWARE_RECOVERY_KEY || '').trim();
    const expectedId = String(process.env.SUPER_ADMIN_ID || '').trim();
    const clientIp = req.cleanIp;

    if (!expectedKey || !expectedId || hardwareKey !== expectedKey || superAdminId !== expectedId) {
      await AuditLog.create({
        user: superAdminId || 'UNKNOWN',
        role: 'SuperAdmin',
        action: 'HARDWARE_RECOVERY_KEY_FAILED',
        category: 'BIOMETRIC_FAIL',
        ipAddress: clientIp,
      });

      const recentFails = await AuditLog.countDocuments({
        ipAddress: clientIp,
        action: 'HARDWARE_RECOVERY_KEY_FAILED',
        createdAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) },
      });

      if (recentFails >= 3) {
        await HackLog.create({
          ipAddress: clientIp,
          cloudflareRayId: req.headers['cf-ray'] || 'DIRECT',
          attackType: 'HARDWARE_RECOVERY_BRUTE_FORCE',
          actionTaken: 'AUTO_BANNED_AFTER_3_FAILS',
          autoBlocked: true,
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid Hardware Recovery Key or Super Admin ID.',
      });
    }

    const superToken = generateSuperAdmin4LayerToken({
      superAdminId: expectedId,
      clientIp,
      layers: { hardwareRecovery: true },
    });

    await AuditLog.create({
      user: expectedId,
      role: 'SuperAdmin',
      action: 'HARDWARE_RECOVERY_KEY_SUCCESS',
      category: 'ADMIN',
      ipAddress: clientIp,
    });

    return res.status(200).json({
      success: true,
      message: 'Offline Hardware Recovery verified. Emergency access granted.',
      superToken,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// PROTECTED SUPER ADMIN ROUTES (Requires 4-Layer Verified Super Token)
// =========================================================================
router.use(verifySuperAdminToken);

// @route   GET /api/v1/x9-super-2026/dashboard
router.get('/dashboard', adminController.getDashboardStats || ((req, res) => res.json({ success: true })));

// @route   POST /api/v1/x9-super-2026/hide-toggle
// @desc    Stealth Hide/Unhide System Control
router.post('/hide-toggle', adminController.toggleHideSystem || ((req, res) => res.json({ success: true })));

