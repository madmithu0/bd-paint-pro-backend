const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { generateTokenPair, verifyRefreshToken } = require('../utils/tokenUtils');
const { sendSmsQueue } = require('../utils/smsUtils');

const ALLOWED_ROLES = ['Customer', 'Mistri', 'Agent', 'Merchant'];

// 1. Signup New Account (Customer / Mistri / Agent / Merchant)
const signup = async (req, res, next) => {
  try {
    const { name, phone, email, password, role = 'Customer' } = req.body;

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

    const existingUser = await User.findOne({ phone: String(phone).trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Phone number is already registered.',
      });
    }

    const user = await User.create({
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim().toLowerCase() : undefined,
      password,
      role,
      verify: role === 'Customer', // Mistri/Agent/Merchant require verification
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

// 3. Send OTP to Phone
const sendOtp = async (req, res, next) => {
  try {
    const { phone, purpose = 'LOGIN' } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const otpCode = String(crypto.randomInt(100000, 999999));
    await OTP.create({
      phone: String(phone).trim(),
      code: otpCode,
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendSmsQueue({
      to: String(phone).trim(),
      text: `Your verification OTP is ${otpCode}. Valid for 5 minutes.`,
    });

    res.status(200).json({
      success: true,
      message: 'OTP sent to your phone number.',
      ...(process.env.DEV_MODE === 'true' && { devOtp: otpCode }),
    });
  } catch (error) {
    next(error);
  }
};

// 4. Verify OTP
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP code are required.' });
    }

    const otpRecord = await OTP.findOne({
      phone: String(phone).trim(),
      code: String(code).trim(),
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP code.',
      });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// 5. Forgot Password (Sends Reset OTP)
const forgotPassword = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone: String(phone).trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this phone number.' });
    }

    const otpCode = String(crypto.randomInt(100000, 999999));
    await OTP.create({
      phone: user.phone,
      code: otpCode,
      purpose: 'FORGOT_PASSWORD',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendSmsQueue({
      to: user.phone,
      text: `Password Reset OTP: ${otpCode}. Do not share this code.`,
    });

    res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to registered phone.',
    });
  } catch (error) {
    next(error);
  }
};

// 6. Reset Password after OTP Check
const resetPassword = async (req, res, next) => {
  try {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Valid phone, OTP code, and new password (min 6 chars) are required.',
      });
    }

    const validOtp = await OTP.findOne({
      phone: String(phone).trim(),
      code: String(code).trim(),
      purpose: 'FORGOT_PASSWORD',
      expiresAt: { $gt: new Date() },
    });

    if (!validOtp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset OTP.' });
    }

    const user = await User.findOne({ phone: String(phone).trim() }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.password = newPassword;
    await user.save();
    await OTP.deleteMany({ phone: user.phone, purpose: 'FORGOT_PASSWORD' });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully. Please login with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// 7. Rotate Refresh Token
const refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;
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
