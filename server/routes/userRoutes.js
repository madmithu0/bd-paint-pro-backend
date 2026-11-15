const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireRole } = require('../middleware/authMiddleware');

// @route   GET /api/v1/users
// @desc    Get User List with pagination & role filtering (Excludes any hidden admin records)
// @access  Protected (Authenticated Users / Admin)
router.get('/', async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    const query = { role: { $in: ['Customer', 'Mistri', 'Agent', 'Merchant'] } };

    if (role && ['Customer', 'Mistri', 'Agent', 'Merchant'].includes(role)) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      users,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/users/:id
// @desc    Get Single User Details
// @access  Protected
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -__v').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/v1/users/:id/block
// @desc    Block or Unblock a User Account
// @access  Protected (Admin / Super Admin Gate Verified)
router.patch('/:id/block', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { isBlocked, reason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.active = !Boolean(isBlocked);
    user.blockReason = isBlocked ? reason || 'Blocked by administrator' : null;
    await user.save();

    res.status(200).json({
      success: true,
      message: isBlocked ? 'User has been blocked.' : 'User has been unblocked.',
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        active: user.active,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
