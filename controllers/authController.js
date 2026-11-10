const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendSMS = require('../utils/sendSMS');
const { success, error } = require('../utils/response');

const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return error(res, 'Phone number required');

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await sendSMS(phone, `Your OTP is ${otp}`);

    // টেস্টের জন্য OTP রিটার্ন করছি, পরে এটা সরিয়ে দিবো
    return success(res, 'OTP sent', { otp });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { phone, otp, name, role } = req.body;

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ phone, name: name || 'User', role: role || 'customer' });
    }

    const token = generateToken(user);
    return success(res, 'Login successful', { user, token });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    return success(res, 'User found', user);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { sendOTP, verifyOTP, getMe };