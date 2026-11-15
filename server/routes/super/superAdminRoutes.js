const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const OTP = require('../../models/OTP');
const AuditLog = require('../../models/AuditLog');
const HackLog = require('../../models/HackLog');
const adminController = require('../../controllers/adminController');
const { sendSuperAdminPhoneOtp } = require('../../utils/smsUtils');
const { sendSuperAdminGmailOtp } = require('../../utils/emailUtils');
const { generateSuperAdmin4LayerToken } = require('../../utils/tokenUtils');
const { verifyVoiceBiometric } = require('../../services/biometric/voiceVerify');
const { verifyFace3DBiometric } = require('../../services/biometric/face3DVerify');

// @route   POST /api/v1/x9-super-2026/send-otps
// @desc    Send Layer-1 (Phone OTP) and Layer-2 (Gmail OTP) to Super Admin
// @access  Secret Route + IP Whitelist
router.post('/send-otps', async (req, res, next) => {
  try {
    const phoneOtp = String(crypto.randomInt(100000, 999999));
    const gmailOtp = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Promise.all([
      OTP.create({
        phone: process.env.SUPER_ADMIN_PHONE,
        code: phoneOtp,
        purpose: 'SUPER_ADMIN_PHONE',
        expiresAt,
      }),
      OTP.create({
        email: process.env.SUPER_ADMIN_GMAIL,
        code: gmailOtp,
        purpose: 'SUPER_ADMIN_GMAIL',
        expiresAt,
      }),
    ]);

    await Promise.all([
      sendSuperAdminPhoneOtp(phoneOtp),
      sendSuperAdminGmailOtp(gmailOtp),
    ]);

    res.status(200).json({
      success: true,
      message: 'Layer-1 Phone OTP and Layer-2 Gmail OTP dispatched to Super Admin.',
      ...(process.env.DEV_MODE === 'true' && { devPhoneOtp: phoneOtp, devGmailOtp: gmailOtp }),
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/x9-super-2026/verify-4-layer
// @desc    Verify All 4 Layers (Phone OTP + Gmail OTP + Live Voice + Live 3D Face)
// @access  Secret Route + IP Whitelist
router.post('/verify-4-layer', async (req, res, next) => {
  try {
    const { phoneOtp, gmailOtp, voiceSampleBase64, voiceTranscript, faceVideoBase64 } = req.body;

    // Layer 1: Phone OTP Check
    const validPhoneOtp = await OTP.findOne({
      phone: process.env.SUPER_ADMIN_PHONE,
      code: String(phoneOtp || '').trim(),
      purpose: 'SUPER_ADMIN_PHONE',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    // Layer 2: Gmail OTP Check
    const validGmailOtp = await OTP.findOne({
      email: process.env.SUPER_ADMIN_GMAIL,
      code: String(gmailOtp || '').trim(),
      purpose: 'SUPER_ADMIN_GMAIL',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    // Layer 3: Live Voice Biometric Check (Score >= 0.90 Lock)
    const voiceResult = await verifyVoiceBiometric({
      voiceSampleBase64,
      transcript: voiceTranscript,
    });

    // Layer 4: Live 3D Face Head Move & Blink Check (Score >= 0.90 Lock)
    const faceResult = await verifyFace3DBiometric({
      faceVideoBase64,
    });

    const layerStatus = {
      phoneOtp: Boolean(validPhoneOtp),
      gmailOtp: Boolean(validGmailOtp),
      voiceVerified: Boolean(voiceResult.verified),
      face3DVerified: Boolean(faceResult.verified),
    };

    // All 4 must be Green to unlock Dashboard
    if (
      !layerStatus.phoneOtp ||
      !layerStatus.gmailOtp ||
      !layerStatus.voiceVerified ||
      !layerStatus.face3DVerified
    ) {
      await AuditLog.create({
        user: process.env.SUPER_ADMIN_ID || 'SUPER_ADMIN',
        role: 'SuperAdmin',
        action: '4_LAYER_BIOMETRIC_VERIFY_FAILED',
        category: 'BIOMETRIC_FAIL',
        ipAddress: req.clientIp,
        details: { layerStatus, voiceScore: voiceResult.score, faceScore: faceResult.score },
      });

      return res.status(401).json({
        success: false,
        message: '4-Layer Verification Failed. All 4 indicators must be green.',
        layers: layerStatus,
        scores: {
          voiceScore: voiceResult.score,
          faceScore: faceResult.score,
        },
      });
    }

    // Mark OTPs as used
    validPhoneOtp.verified = true;
    validGmailOtp.verified = true;
    await Promise.all([validPhoneOtp.save(), validGmailOtp.save()]);

    const superToken = generateSuperAdmin4LayerToken({
      superAdminId: process.env.SUPER_ADMIN_ID,
      clientIp: req.clientIp,
      layers: layerStatus,
    });

    await AuditLog.create({
      user: process.env.SUPER_ADMIN_ID,
      role: 'SuperAdmin',
      action: '4_LAYER_BIOMETRIC_VERIFY_SUCCESS',
      category: 'ADMIN',
      ipAddress: req.clientIp,
    });

    res.status(200).json({
      success: true,
      message: 'All 4 Security Layers Green! Super Admin Dashboard Unlocked.',
      layers: layerStatus,
      superToken,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/x9-super-2026/hardware-recovery
// @desc    Offline Hardware Recovery Key Fallback when Biometric API is Down
// @access  Secret Route + IP Whitelist
router.post('/hardware-recovery', async (req, res, next) => {
  try {
    const { hardwareKey, superAdminId } = req.body;
    const expectedKey = process.env.OFFLINE_HARDWARE_RECOVERY_KEY;
    const expectedId = process.env.SUPER_ADMIN_ID;

    if (!expectedKey || hardwareKey !== expectedKey || superAdminId !== expectedId) {
      await AuditLog.create({
        user: superAdminId || 'UNKNOWN',
        action: 'HARDWARE_RECOVERY_KEY_FAILED',
        category: 'BIOMETRIC_FAIL',
        ipAddress: req.clientIp,
      });
      return res.status(401).json({ success: false, message: 'Invalid Offline Hardware Recovery Key.' });
    }

    const superToken = generateSuperAdmin4LayerToken({
      superAdminId: expectedId,
      clientIp: req.clientIp,
      layers: { phoneOtp: true, gmailOtp: true, voiceVerified: true, face3DVerified: true },
    });

    await AuditLog.create({
      user: expectedId,
      role: 'SuperAdmin',
      action: 'EMERGENCY_HARDWARE_KEY_LOGIN',
      category: 'ADMIN',
      ipAddress: req.clientIp,
    });

    res.status(200).json({
      success: true,
      message: 'Emergency Hardware Recovery Key accepted. Dashboard unlocked.',
      superToken,
    });
  } catch (error) {
    next(error);
  }
});

// Protected Super Admin Control Endpoints (Requires 4-Layer Token via superAdminGate)
router.get('/dashboard', adminController.getDashboardStats);
router.post('/verify-account', adminController.verifyAccount);
router.post('/manage-user', adminController.manageUserAccount);
router.post('/reset-user-password', adminController.adminResetUserPassword);
router.post('/hide-toggle', adminController.toggleHideMode);

router.get('/hack-logs', async (req, res, next) => {
  try {
    const logs = await HackLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.status(200).json({ success: true, logs });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ time: -1 }).limit(200).lean();
    res.status(200).json({ success: true, logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
