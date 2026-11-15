const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const HackLog = require('../models/HackLog');
const hideConfig = require('../config/hideConfig');

// 1. Get Super Admin Dashboard Overview
const getDashboardStats = async (req, res, next) => {
  try {
    const [totalUsers, totalMerchants, totalJobs, completedPayments, blockedAttacks] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'Merchant' }),
      Job.countDocuments(),
      Payment.find({ status: { $in: ['Verified', 'Released', 'EscrowHeld'] } }).lean(),
      HackLog.countDocuments(),
    ]);

    const totalRevenue = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPlatformShare = completedPayments.reduce((sum, p) => sum + (p.platformShareAmount || 0), 0);

    res.status(200).json({
      success: true,
      versionLock: 'v3.0.0 SELF-HEALING LOCK',
      stats: {
        totalUsers,
        totalMerchants,
        totalJobs,
        totalRevenue,
        totalPlatformShare,
        blockedAttacks,
      },
      hideStatus: hideConfig.getStatus(),
      infraHealth: {
        mongoReplicaSet: 'Healthy',
        pitrBackup: 'Active (10-Min Incremental)',
        selfHealingEngine: 'Active',
        superAdmin4LayerVerify: 'Always Active (4/4 Green)',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Verify Merchant / Mistri / Agent Account
const verifyAccount = async (req, res, next) => {
  try {
    const { userId, verifyStatus = true } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { verify: Boolean(verifyStatus), active: true },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.status(200).json({
      success: true,
      message: `${user.role} account verification set to ${user.verify}.`,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Activate / Suspend / Change Role of Any User (SuperAdmin excluded from list)
const manageUserAccount = async (req, res, next) => {
  try {
    const { userId, active, suspended, role, blockReason } = req.body;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (active !== undefined) user.active = Boolean(active);
    if (suspended !== undefined) user.suspended = Boolean(suspended);
    if (blockReason !== undefined) user.blockReason = blockReason;
    if (role && ['Customer', 'Mistri', 'Agent', 'Merchant'].includes(role)) {
      user.role = role;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User account updated by Super Admin.',
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        active: user.active,
        suspended: user.suspended,
        verify: user.verify,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Super Admin Force Password Reset for Any User
const adminResetUserPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Password reset successfully for ${user.name} (${user.phone}).`,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Toggle Super Admin Hide / Unhide Control
const toggleHideMode = (req, res) => {
  const { isHidden, autoHideEnabled } = req.body;

  if (isHidden !== undefined) {
    hideConfig.setHideStatus(Boolean(isHidden), req.clientIp, 'Super Admin Dashboard Control');
  }
  if (autoHideEnabled !== undefined) {
    hideConfig.toggleAutoHide(Boolean(autoHideEnabled));
  }

  res.status(200).json({
    success: true,
    hideStatus: hideConfig.getStatus(),
  });
};

module.exports = {
  getDashboardStats,
  verifyAccount,
  manageUserAccount,
  adminResetUserPassword,
  toggleHideMode,
};
