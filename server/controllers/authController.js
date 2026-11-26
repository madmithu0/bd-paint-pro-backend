const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const securityConfig = require('../config/securityConfig');
const { generateTokenPair, verifyRefreshToken } = require('../utils/tokenUtils');
const { verifyFirebasePhoneToken } = require('../utils/smsUtils');
const { sendUserGmailOtp } = require('../utils/emailUtils');
const { validateRoleTermsAcceptance, recordUserTermsAcceptance } = require('../legal/termsVersion');

const ALLOWED_ROLES = ['Customer', 'Mistri', 'Agent', 'Merchant'];

const generateSixDigitOtp = () => String(crypto.randomInt(100000, 999999));

const normalizeBdPhone = (rawPhone) => {
  const cleaned = String(rawPhone || '').replace(/[\s-]/g, '');
  if (cleaned.startsWith('+880')) return cleaned;
  if (cleaned.startsWith('880')) return `+${cleaned}`;
  if (cleaned.startsWith('01')) return `+88${cleaned}`;
  return cleaned;
};

const validatePasswordStrength = (password) => {
  const pwd = String(password || '');
  const policy = securityConfig.passwordPolicy;
  if (pwd.length < policy.minLength || pwd.length > policy.maxLength) {
    return `Password must be between ${policy.minLength} and ${policy.maxLength} characters.`;
  }
  if (policy.requireUppercase && !/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.';
  if (policy.requireLowercase && !/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter.';
  if (policy.requireNumber && !/\d/.test(pwd)) return 'Password must contain at least one number.';
  if (policy.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`]/.test(pwd)) {
    return 'Password must contain at least one special character.';
  }
  return null;
};

const signup = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      role = 'Customer',
      district = '',
      upazila = '',
      referralCode = '',
      termsAccepted = false,
      merchantCommissionAgreed = false,
      firebaseIdToken,
    } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, phone number, and password are required.' });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(403).json({ success: false, message: 'Invalid role selected.' });
    }

    const pwdError = validatePasswordStrength(password);
    if (pwdError) {
      return res.status(400).json({ success: false, message: pwdError });
    }

    const termsCheck = validateRoleTermsAcceptance({ role, termsAccepted, merchantCommissionAgreed });
    if (!termsCheck.valid) {
      return res.status(400).json({ success: false, code: termsCheck.code, message: termsCheck.message });
    }

    const cleanPhone = String(phone).trim();
    const existingUser = await User.findOne({ phone: cleanPhone });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Phone number is already registered.' });
    }

    let referredByAgent = null;
    if (referralCode) {
      const agentUser = await User.findOne({ referralCode: String(referralCode).trim().toUpperCase(), role: 'Agent' });
      if (agentUser) referredByAgent = agentUser._id;
    }

    let phoneVerifiedViaFirebase = false;
    if (firebaseIdToken) {
      const fbResult = await verifyFirebasePhoneToken(firebaseIdToken);
      if (normalizeBdPhone(fbResult.phone) === normalizeBdPhone(cleanPhone)) {
        phoneVerifiedViaFirebase = true;
      }
    }

    const user = await User.create({
      name: String(name).trim(),
      phone: cleanPhone,
      email: email ? String(email).trim().toLowerCase() : undefined,
      passwordHash: password,
      role,
      district: String(district).trim(),
      upazila: String(upazila).trim(),
      referredByAgent,
      termsAcceptedVersion: termsCheck.roleVersion,
      merchantCommissionAgreed: role === 'Merchant' ? Boolean(merchantCommissionAgreed) : false,
      accountStatus: 'Active',
      verify: phoneVerifiedViaFirebase || role === 'Customer',
      active: true,
    });

    await recordUserTermsAcceptance({
      userId: user._id,
      role,
      merchantCommissionAgreed,
      ipAddress: req.clientIp || req.ip,
      deviceInfo: req.headers['user-agent'],
    }).catch(() => {});

    const tokens = generateTokenPair({ id: user._id, role: user.role });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        verify: user.verify,
        termsAcceptedVersion: user.termsAcceptedVersion,
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};
const login = async (req, res, next) => {
  try {
    const { identifier, phone, email, password } = req.body;
    const loginId = identifier || phone || email;

    if (!loginId || !password) {
      return res.status(400).json({ success: false, message: 'Phone/Email and password are required.' });
    }

    const query = String(loginId).includes('@')
      ? { email: String(loginId).trim().toLowerCase() }
      : { phone: String(loginId).trim() };

    const user = await User.findOne(query).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.isLocked && user.isLocked()) {
      const remainingMins = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        locked: true,
        message: `Account temporarily locked due to failed login attempts. Try again in ${remainingMins} minutes.`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const maxAttempts = securityConfig.passwordPolicy.maxFailedAttempts || 5;
      const updateData = { failedLoginAttempts: attempts };

      if (attempts >= maxAttempts) {
        updateData.lockUntil = new Date(Date.now() + (securityConfig.passwordPolicy.lockDurationMs || 30 * 60 * 1000));
        updateData.failedLoginAttempts = 0;
      }
      await User.updateOne({ _id: user._id }, { $set: updateData });

      return res.status(401).json({
        success: false,
        message: attempts >= maxAttempts
          ? 'Too many failed attempts. Account locked for 30 minutes.'
          : 'Invalid credentials.',
      });
    }

    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
    }

    if (!user.active || user.suspended || user.accountStatus === 'Suspended' || user.accountStatus === 'Banned') {
      return res.status(403).json({
        success: false,
        message: user.blockReason || 'Account is blocked or suspended.',
      });
    }

    const tokens = generateTokenPair({ id: user._id, role: user.role });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        verify: user.verify,
        termsAcceptedVersion: user.termsAcceptedVersion,
        merchantCommissionAgreed: user.merchantCommissionAgreed,
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

const sendOtp = async (req, res, next) => {
  try {
    const { email, phone, purpose = 'LOGIN' } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Email or phone number is required to send OTP.' });
    }

    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      const otpCode = generateSixDigitOtp();

      await OTP.deleteMany({ email: cleanEmail, purpose });
      await OTP.create({
        email: cleanEmail,
        code: otpCode,
        provider: 'GMAIL_SMTP',
        purpose,
      });

      await sendUserGmailOtp({ email: cleanEmail, otpCode, purpose });

      return res.status(200).json({
        success: true,
        provider: 'GMAIL_SMTP',
        message: 'Verification OTP sent to your Gmail.',
      });
    }

    const cleanPhone = String(phone).trim();
    await OTP.deleteMany({ phone: cleanPhone, purpose });
    await OTP.create({ phone: cleanPhone, provider: 'FIREBASE_PHONE', purpose });

    return res.status(200).json({
      success: true,
      provider: 'FIREBASE_PHONE',
      useFirebase: true,
      formattedPhone: normalizeBdPhone(cleanPhone),
      message: 'Proceed with Firebase phone OTP verification.',
    });
  } catch (error) {
    next(error);
  }
};
const verifyOtp = async (req, res, next) => {
  try {
    const { email, phone, code, firebaseIdToken, purpose = 'LOGIN' } = req.body;

    if (firebaseIdToken) {
      const fbVerified = await verifyFirebasePhoneToken(firebaseIdToken);
      const rawInputPhone = phone ? String(phone).trim() : fbVerified.phone;

      if (phone && normalizeBdPhone(fbVerified.phone) !== normalizeBdPhone(rawInputPhone)) {
        return res.status(400).json({ success: false, message: 'Verified Firebase phone number does not match.' });
      }

      await OTP.findOneAndUpdate(
        { phone: rawInputPhone, purpose },
        { phone: rawInputPhone, provider: 'FIREBASE_PHONE', firebaseUid: fbVerified.firebaseUid, verified: true },
        { upsert: true, new: true }
      );

      const user = await User.findOneAndUpdate(
        { phone: { $in: [rawInputPhone, fbVerified.phone, rawInputPhone.replace(/^\+88/, '')] } },
        { verify: true },
        { new: true }
      );

      const tokens = user ? generateTokenPair({ id: user._id, role: user.role }) : {};

      return res.status(200).json({
        success: true,
        verified: true,
        provider: 'FIREBASE_PHONE',
        message: 'Phone number verified via Firebase.',
        user: user
          ? { id: user._id, name: user.name, phone: user.phone, email: user.email, role: user.role, verify: user.verify }
          : null,
        ...tokens,
      });
    }

    if (email && code) {
      const cleanEmail = String(email).trim().toLowerCase();
      const otpRecord = await OTP.findOne({ email: cleanEmail, purpose, verified: false }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'OTP expired or not found. Please request a new one.' });
      }

      if (otpRecord.attempts >= 5) {
        return res.status(429).json({ success: false, message: 'Too many wrong attempts. Request a new OTP.' });
      }

      if (otpRecord.code !== String(code).trim()) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
      }

      otpRecord.verified = true;
      await otpRecord.save();

      const user = await User.findOneAndUpdate({ email: cleanEmail }, { verify: true }, { new: true });
      const tokens = user ? generateTokenPair({ id: user._id, role: user.role }) : {};

      return res.status(200).json({
        success: true,
        verified: true,
        provider: 'GMAIL_SMTP',
        message: 'Gmail verified successfully.',
        user: user
          ? { id: user._id, name: user.name, phone: user.phone, email: user.email, role: user.role, verify: user.verify }
          : null,
        ...tokens,
      });
    }

    return res.status(400).json({ success: false, message: 'Provide either (email + code) or firebaseIdToken.' });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { identifier, email, phone } = req.body;
    const target = identifier || email || phone;

    if (!target) {
      return res.status(400).json({ success: false, message: 'Email or phone number is required.' });
    }

    const isEmail = String(target).includes('@');
    const user = await User.findOne(
      isEmail ? { email: String(target).trim().toLowerCase() } : { phone: String(target).trim() }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email or phone.' });
    }
    if (isEmail) {
      const otpCode = generateSixDigitOtp();
      await OTP.deleteMany({ email: user.email, purpose: { $in: ['FORGOT_PASSWORD', 'PASSWORD_RESET'] } });
      await OTP.create({
        email: user.email,
        code: otpCode,
        provider: 'GMAIL_SMTP',
        purpose: 'PASSWORD_RESET',
      });

      await sendUserGmailOtp({ email: user.email, otpCode, purpose: 'Password Reset' });

      return res.status(200).json({
        success: true,
        provider: 'GMAIL_SMTP',
        message: 'Password reset OTP sent to your Gmail.',
      });
    }

    return res.status(200).json({
      success: true,
      provider: 'FIREBASE_PHONE',
      useFirebase: true,
      formattedPhone: normalizeBdPhone(user.phone),
      message: 'Verify your phone via Firebase OTP to reset password.',
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, phone, code, firebaseIdToken, newPassword } = req.body;

    const pwdError = validatePasswordStrength(newPassword);
    if (pwdError) {
      return res.status(400).json({ success: false, message: pwdError });
    }

    let user = null;

    if (firebaseIdToken) {
      const fbVerified = await verifyFirebasePhoneToken(firebaseIdToken);
      const localPhone = fbVerified.phone.replace(/^\+88/, '');
      user = await User.findOne({
        phone: { $in: [fbVerified.phone, localPhone, phone].filter(Boolean) },
      }).select('+passwordHash +passwordHistory');
    } else if (email && code) {
      const cleanEmail = String(email).trim().toLowerCase();
      const otpRecord = await OTP.findOne({
        email: cleanEmail,
        purpose: { $in: ['FORGOT_PASSWORD', 'PASSWORD_RESET'] },
        code: String(code).trim(),
        verified: false,
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset OTP.' });
      }

      otpRecord.verified = true;
      await otpRecord.save();
      user = await User.findOne({ email: cleanEmail }).select('+passwordHash +passwordHistory');
    } else {
      return res.status(400).json({ success: false, message: 'Provide (email + code) or firebaseIdToken.' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const isSameOld = await user.comparePassword(newPassword);
    if (isSameOld) {
      return res.status(400).json({ success: false, message: 'New password must be different from your previous password.' });
    }

    if (user.passwordHash) {
      user.passwordHistory = [user.passwordHash, ...(user.passwordHistory || [])].slice(0, 3);
    }
    user.passwordHash = newPassword;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (error) {
    next(error);
  }
};
const acceptRoleTerms = async (req, res, next) => {
  try {
    const { termsAccepted = true, merchantCommissionAgreed = false } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const termsCheck = validateRoleTermsAcceptance({
      role: user.role,
      termsAccepted,
      merchantCommissionAgreed,
    });
    if (!termsCheck.valid) {
      return res.status(400).json({ success: false, code: termsCheck.code, message: termsCheck.message });
    }

    user.termsAcceptedVersion = termsCheck.roleVersion;
    if (user.role === 'Merchant') {
      user.merchantCommissionAgreed = true;
    }
    await user.save();

    await recordUserTermsAcceptance({
      userId: user._id,
      role: user.role,
      merchantCommissionAgreed: user.merchantCommissionAgreed,
      ipAddress: req.clientIp || req.ip,
      deviceInfo: req.headers['user-agent'],
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Role-specific Terms & Conditions accepted.',
      termsAcceptedVersion: user.termsAcceptedVersion,
      merchantCommissionAgreed: user.merchantCommissionAgreed,
    });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = req.body.refreshToken || req.headers['x-refresh-token'];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    const decoded = verifyRefreshToken(token);
    const tokens = generateTokenPair({ id: decoded.id, role: decoded.role });

    res.status(200).json({
      success: true,
      ...tokens,
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};

module.exports = {
  signup,
  login,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  acceptRoleTerms,
  refreshToken,
};
