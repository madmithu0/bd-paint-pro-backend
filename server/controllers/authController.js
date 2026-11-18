const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { generateTokenPair, verifyRefreshToken } = require('../utils/tokenUtils');
const { verifyFirebasePhoneToken } = require('../utils/smsUtils');
const { sendUserGmailOtp } = require('../utils/emailUtils');

const ALLOWED_ROLES = ['Customer', 'Mistri', 'Agent', 'Merchant'];

const generateSixDigitOtp = () => String(crypto.randomInt(100000, 999999));

const normalizeBdPhone = (rawPhone) => {
  const cleaned = String(rawPhone || '').replace(/[\s-]/g, '');
  if (cleaned.startsWith('+880')) return cleaned;
  if (cleaned.startsWith('880')) return `+${cleaned}`;
  if (cleaned.startsWith('01')) return `+88${cleaned}`;
  return cleaned;
};

// 1. Signup New Account (Customer / Mistri / Agent / Merchant)
const signup = async (req, res, next) => {
  try {
    const { name, phone, email, password, role = 'Customer', firebaseIdToken } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone number, and password are required.',
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid role selected.',
      });
    }

    const cleanPhone = String(phone).trim();
    const existingUser = await User.findOne({ phone: cleanPhone });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Phone number is already registered.',
      });
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
      password,
      role,
      verify: phoneVerifiedViaFirebase || role === 'Customer',
      active: true,
    });

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
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Login User with Phone or Email & Password
const login = async (req, res, next) => {
  try {
    const { identifier, phone, email, password } = req.body;
    const loginId = identifier || phone || email;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone/Email and password are required.',
      });
    }

    const query = String(loginId).includes('@')
      ? { email: String(loginId).trim().toLowerCase() }
      : { phone: String(loginId).trim() };

    const user = await User.findOne(query).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    if (!user.active || user.suspended) {
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
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};
// 3. Send Free OTP (Gmail SMTP for Email OR Instructs Frontend to trigger Free Firebase Phone OTP)
const sendOtp = async (req, res, next) => {
  try {
    const { email, phone, purpose = 'LOGIN' } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required to send OTP.',
      });
    }

    // Free Gmail SMTP OTP Flow
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

      await sendUserGmailOtp({
        email: cleanEmail,
        otpCode,
        purpose,
      });

      return res.status(200).json({
        success: true,
        provider: 'GMAIL_SMTP',
        message: 'Free verification OTP sent to your Gmail.',
      });
    }

    // Free Firebase Phone Auth Flow (Zero SMS cost on server)
    const cleanPhone = String(phone).trim();
    await OTP.deleteMany({ phone: cleanPhone, purpose });
    await OTP.create({
      phone: cleanPhone,
      provider: 'FIREBASE_PHONE',
      purpose,
    });

    return res.status(200).json({
      success: true,
      provider: 'FIREBASE_PHONE',
      useFirebase: true,
      formattedPhone: normalizeBdPhone(cleanPhone),
      message: 'Proceed with free Firebase phone OTP verification.',
    });
  } catch (error) {
    next(error);
  }
};

// 4. Verify Free OTP (Verifies either Gmail 6-digit code OR Firebase Phone ID Token)
const verifyOtp = async (req, res, next) => {
  try {
    const { email, phone, code, firebaseIdToken, purpose = 'LOGIN' } = req.body;

    // Case A: Free Firebase Phone Token Verification
    if (firebaseIdToken) {
      const fbVerified = await verifyFirebasePhoneToken(firebaseIdToken);
      const rawInputPhone = phone ? String(phone).trim() : fbVerified.phone;

      if (phone && normalizeBdPhone(fbVerified.phone) !== normalizeBdPhone(rawInputPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Verified Firebase phone number does not match.',
        });
      }

      await OTP.findOneAndUpdate(
        { phone: rawInputPhone, purpose },
        {
          phone: rawInputPhone,
          provider: 'FIREBASE_PHONE',
          firebaseUid: fbVerified.firebaseUid,
          verified: true,
        },
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
        message: 'Phone number verified for free via Firebase.',
        user: user
          ? {
              id: user._id,
              name: user.name,
              phone: user.phone,
              email: user.email,
              role: user.role,
              verify: user.verify,
            }
          : null,
        ...tokens,
      });
    }

    // Case B: Free Gmail OTP Code Verification
    if (email && code) {
      const cleanEmail = String(email).trim().toLowerCase();
      const otpRecord = await OTP.findOne({ email: cleanEmail, purpose, verified: false }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: 'OTP expired or not found. Please request a new one.',
        });
      }

      if (otpRecord.attempts >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Too many wrong attempts. Request a new OTP.',
        });
      }

      if (otpRecord.code !== String(code).trim()) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP code.',
        });
      }

      otpRecord.verified = true;
      await otpRecord.save();

      const user = await User.findOneAndUpdate(
        { email: cleanEmail },
        { verify: true },
        { new: true }
      );

      const tokens = user ? generateTokenPair({ id: user._id, role: user.role }) : {};

      return res.status(200).json({
        success: true,
        verified: true,
        provider: 'GMAIL_SMTP',
        message: 'Gmail verified successfully.',
        user: user
          ? {
              id: user._id,
              name: user.name,
              phone: user.phone,
              email: user.email,
              role: user.role,
              verify: user.verify,
            }
          : null,
        ...tokens,
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Provide either (email + code) or firebaseIdToken.',
    });
  } catch (error) {
    next(error);
  }
};
// 5. Forgot Password (Sends Free Gmail OTP or triggers Firebase Phone Reset)
const forgotPassword = async (req, res, next) => {
  try {
    const { identifier, email, phone } = req.body;
    const target = identifier || email || phone;

    if (!target) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required.',
      });
    }

    const isEmail = String(target).includes('@');
    const user = await User.findOne(
      isEmail
        ? { email: String(target).trim().toLowerCase() }
        : { phone: String(target).trim() }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email or phone.',
      });
    }

    if (isEmail) {
      const otpCode = generateSixDigitOtp();
      await OTP.deleteMany({ email: user.email, purpose: 'FORGOT_PASSWORD' });
      await OTP.create({
        email: user.email,
        code: otpCode,
        provider: 'GMAIL_SMTP',
        purpose: 'FORGOT_PASSWORD',
      });

      await sendUserGmailOtp({
        email: user.email,
        otpCode,
        purpose: 'Password Reset',
      });

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

// 6. Reset Password using Verified Gmail OTP or Firebase Phone Token
const resetPassword = async (req, res, next) => {
  try {
    const { email, phone, code, firebaseIdToken, newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    let user = null;

    if (firebaseIdToken) {
      const fbVerified = await verifyFirebasePhoneToken(firebaseIdToken);
      const localPhone = fbVerified.phone.replace(/^\+88/, '');
      user = await User.findOne({
        phone: { $in: [fbVerified.phone, localPhone, phone].filter(Boolean) },
      }).select('+password');
    } else if (email && code) {
      const cleanEmail = String(email).trim().toLowerCase();
      const otpRecord = await OTP.findOne({
        email: cleanEmail,
        purpose: 'FORGOT_PASSWORD',
        code: String(code).trim(),
        verified: false,
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset OTP.',
        });
      }

      otpRecord.verified = true;
      await otpRecord.save();
      user = await User.findOne({ email: cleanEmail }).select('+password');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide (email + code) or firebaseIdToken.',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// 7. Refresh Access Token
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
  refreshToken,
};
