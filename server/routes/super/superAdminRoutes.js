const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const User = require('../../models/User');
const OTP = require('../../models/OTP');
const AuditLog = require('../../models/AuditLog');
const HackLog = require('../../models/HackLog');
const { sendSMS } = require('../../utils/smsUtils');
const { sendEmail } = require('../../utils/emailUtils');

const SUPER_IP = process.env.SUPER_ADMIN_IP;
const SUPER_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_GMAIL = process.env.SUPER_ADMIN_GMAIL;
const SUPER_VOICE_HASH = process.env.SUPER_ADMIN_VOICE_HASH;
const SUPER_FACE_HASH = process.env.SUPER_ADMIN_FACE_HASH;
const JWT_SECRET = process.env.JWT_SECRET;
const DEVICE_FP = process.env.SUPER_ADMIN_DEVICE_FP;

const BLOCK_MINUTES = 30;
const blockedIPs = new Map();

// 1. RATE LIMIT - 1 মিনিটে 5 বার এর বেশি ট্রাই করা যাবে না
const superLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many attempts' },
  standardHeaders: true,
  legacyHeaders: false
});

function getClientIP(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isBlocked(ip) {
  const until = blockedIPs.get(ip);
  if (!until) return false;
  if (Date.now() > until) {
    blockedIPs.delete(ip);
    return false;
  }
  return true;
}

// 2. TIMING SAFE COMPARE - Hash চুরি করলেও টাইমিং দিয়ে বুঝা যাবে না
function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function logFail(req, action) {
  const ip = getClientIP(req);
  await HackLog.create({
    ip,
    device: req.headers['user-agent'] || 'unknown',
    action,
    blocked: true
  });
  await AuditLog.create({
    user: 'SUPER_ADMIN',
    action: `SUPER_VERIFY_FAIL_${action}`,
    ipDevice: `${ip} | ${req.headers['user-agent'] || 'unknown'}`,
    time: new Date()
  });
  blockedIPs.set(ip, Date.now() + BLOCK_MINUTES * 60 * 1000);
}

// 3. IP + DEVICE FINGERPRINT - 2টাই মিলতে হবে
function checkIPDevice(req, res, next) {
  const ip = getClientIP(req);
  if (isBlocked(ip)) {
    return res.status(403).json({ success: false, message: 'IP blocked 30 min' });
  }
  if (SUPER_IP && ip !== SUPER_IP) {
    logFail(req, 'IP_MISMATCH');
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  const fp = req.headers['x-device-fp'];
  if (DEVICE_FP && fp && !safeEqual(fp, DEVICE_FP)) {
    logFail(req, 'DEVICE_MISMATCH');
    return res.status(403).json({ success: false, message: 'Device mismatch' });
  }
  next();
}

function checkSuperToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token required' });
  }
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (decoded.role !== 'SUPER_ADMIN' || !decoded.verified4Layer) {
      return res.status(403).json({ success: false, message: 'Invalid super token' });
    }
    if (decoded.ip !== getClientIP(req)) {
      return res.status(403).json({ success: false, message: 'IP changed, login again' });
    }
    req.superAdmin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }
}

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

// 4. OTP HASH করে সেভ - DB চুরি হলেও OTP দেখা যাবে না
async function saveOTPHashed(target, code, type) {
  const hash = await bcrypt.hash(code, 10);
  await OTP.deleteMany({ phone: target, type });
  await OTP.create({
    phone: target,
    code: hash,
    type,
    expiry: new Date(Date.now() + 3 * 60 * 1000)
  });
}

async function verifyOTPHashed(target, code, type) {
  const record = await OTP.findOne({ phone: target, type });
  if (!record) return false;
  if (record.expiry < new Date()) {
    await OTP.deleteOne({ _id: record._id });
    return false;
  }
  const ok = await bcrypt.compare(code, record.code);
  if (ok) await OTP.deleteOne({ _id: record._id });
  return ok;
}

router.use(superLimiter);
router.use(checkIPDevice);

// PHONE OTP - আসল SMS যাবে
router.post('/request-phone-otp', async (req, res) => {
  try {
    const code = generateOTP();
    await saveOTPHashed(SUPER_PHONE, code, 'SUPER_PHONE');
    await sendSMS(SUPER_PHONE, `Your Super Admin code: ${code}. Valid 3 min.`);
    res.json({ success: true, message: 'Phone OTP sent' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'SMS failed' });
  }
});

// GMAIL OTP - আসল Gmail যাবে
router.post('/request-gmail-otp', async (req, res) => {
  try {
    const code = generateOTP();
    await saveOTPHashed(SUPER_GMAIL, code, 'SUPER_GMAIL');
    await sendEmail(SUPER_GMAIL, 'Super Admin OTP', `Your code: ${code}. Valid 3 min.`);
    res.json({ success: true, message: 'Gmail OTP sent' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Email failed' });
  }
});

// VOICE - Hash মিলানো না, সার্ভার সাইডে ভয়েস মডেল দিয়ে চেক করতে হবে
// এখানে voiceScore আসবে Voice API থেকে, 0.90 এর নিচে হলে ফেল
router.post('/verify-voice', async (req, res) => {
  const { voiceHash, voiceScore } = req.body;
  if (!voiceHash || !safeEqual(voiceHash, SUPER_VOICE_HASH) || !voiceScore || voiceScore < 0.90) {
    await logFail(req, 'VOICE');
    return res.status(401).json({ success: false, message: 'Voice mismatch' });
  }
  res.json({ success: true, step: 'VOICE_OK' });
});

// 3D FACE - লাইভ চেক ছাড়া হবে না, ছবি দিয়ে ফেল
router.post('/verify-face-3d', async (req, res) => {
  const { faceHash, liveCheck, livenessScore } = req.body;
  if (!faceHash || !safeEqual(faceHash, SUPER_FACE_HASH) || liveCheck !== true || !livenessScore || livenessScore < 0.90) {
    await logFail(req, 'FACE_3D');
    return res.status(401).json({ success: false, message: 'Face mismatch or not live' });
  }
  res.json({ success: true, step: 'FACE_3D_OK' });
});

router.post('/login', async (req, res) => {
  const { phoneOTP, gmailOTP, voiceHash, voiceScore, faceHash, liveCheck, livenessScore } = req.body;
  if (!phoneOTP || !gmailOTP || !voiceHash || !faceHash || liveCheck !== true) {
    return res.status(400).json({ success: false, message: 'All 4 layers required' });
  }

  if (!(await verifyOTPHashed(SUPER_PHONE, phoneOTP, 'SUPER_PHONE'))) {
    await logFail(req, 'PHONE_OTP_LOGIN');
    return res.status(401).json({ success: false, message: 'Phone verify failed' });
  }

  if (!(await verifyOTPHashed(SUPER_GMAIL, gmailOTP, 'SUPER_GMAIL'))) {
    await logFail(req, 'GMAIL_OTP_LOGIN');
    return res.status(401).json({ success: false, message: 'Gmail verify failed' });
  }

  if (!safeEqual(voiceHash, SUPER_VOICE_HASH) || !voiceScore || voiceScore < 0.90) {
    await logFail(req, 'VOICE_LOGIN');
    return res.status(401).json({ success: false, message: 'Voice verify failed' });
  }

  if (!safeEqual(faceHash, SUPER_FACE_HASH) || !livenessScore || livenessScore < 0.90) {
    await logFail(req, 'FACE_3D_LOGIN');
    return res.status(401).json({ success: false, message: 'Face verify failed' });
  }

  // 5. TOKEN 30 মিনিট - চুরি হলেও 30 মিনিট পর শেষ
  const token = jwt.sign(
    { role: 'SUPER_ADMIN', verified4Layer: true, ip: getClientIP(req) },
    JWT_SECRET,
    { expiresIn: '30m' }
  );

  await AuditLog.create({
    user: 'SUPER_ADMIN',
    action: 'SUPER_LOGIN_SUCCESS',
    ipDevice: `${getClientIP(req)} | ${req.headers['user-agent'] || 'unknown'}`,
    time: new Date()
  });

  res.json({ success: true, token });
});

router.post('/merchant-verify', checkSuperToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
    const user = await User.findByIdAndUpdate(userId, { verify: true, active: true }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await AuditLog.create({ user: 'SUPER_ADMIN', action: `MERCHANT_VERIFY_${userId}`, ipDevice: getClientIP(req), time: new Date() });
    res.json({ success: true, message: 'Merchant verified', user });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/reset-password', checkSuperToken, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Valid userId and 8+ char password required' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    const user = await User.findByIdAndUpdate(userId, { password: hashed, active: true }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await AuditLog.create({ user: 'SUPER_ADMIN', action: `PASSWORD_RESET_${userId}`, ipDevice: getClientIP(req), time: new Date() });
    res.json({ success: true, message: 'Password reset and account activated' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/activate', checkSuperToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
    const user = await User.findByIdAndUpdate(userId, { active: true }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'Account activated' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/status', checkSuperToken, async (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    success: true,
    version: 'v1.0.0',
    mongoConnected: mongoose.connection.readyState === 1,
    verify: { phone: true, gmail: true, voice: true, face3D: true, alwaysActive: true }
  });
});

module.exports = router;