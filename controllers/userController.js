const User = require('../models/User');
const { success, error } = require('../utils/response');

const updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    if (req.file) updates.profilePic = req.file.filename;

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    return success(res, 'Profile updated', user);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return error(res, 'User not found', 404);
    return success(res, 'User found', user);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getAllWorkers = async (req, res) => {
  try {
    const workers = await User.find({ role: 'worker' }).select('-password');
    return success(res, 'Workers found', workers);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { updateProfile, getUserById, getAllWorkers };