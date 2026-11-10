const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const { success, error } = require('../utils/response');

const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalWorkers = await User.countDocuments({ role: 'worker' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalJobs = await Job.countDocuments();
    const pendingJobs = await Job.countDocuments({ status: 'pending' });
    const completedJobs = await Job.countDocuments({ status: 'completed' });

    const payments = await Payment.find({ status: 'paid' });
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return success(res, 'Dashboard stats', {
      totalUsers,
      totalWorkers,
      totalCustomers,
      totalJobs,
      pendingJobs,
      completedJobs,
      totalRevenue
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return success(res, 'Users found', users);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const blockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true }
    ).select('-password');

    if (!user) return error(res, 'User not found', 404);
    return success(res, 'User blocked', user);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const unblockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false },
      { new: true }
    ).select('-password');

    if (!user) return error(res, 'User not found', 404);
    return success(res, 'User unblocked', user);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const verifyWorker = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true }
    ).select('-password');

    if (!user) return error(res, 'User not found', 404);
    return success(res, 'Worker verified', user);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  blockUser,
  unblockUser,
  verifyWorker
};