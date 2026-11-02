const Mistri = require('../models/Mistri');
const User = require('../models/User');
const Job = require('../models/Job');

// @desc Get all mistris
// @route GET /api/mistris
const getMistris = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, skill, isAvailable, isActive } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (skill) {
      query.skills = { $in: [skill] };
    }

    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const mistris = await Mistri.find(query)
      .populate('userId', 'name email role')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ rating: -1, createdAt: -1 });

    const total = await Mistri.countDocuments(query);

    res.json({
      success: true,
      data: mistris,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single mistri
// @route GET /api/mistris/:id
const getMistri = async (req, res, next) => {
  try {
    const mistri = await Mistri.findById(req.params.id)
      .populate('userId');

    if (!mistri) {
      return res.status(404).json({
        success: false,
        message: 'Mistri not found'
      });
    }

    const totalJobs = await Job.countDocuments({ mistriId: mistri._id });
    const completedJobs = await Job.countDocuments({
      mistriId: mistri._id,
      status: 'completed'
    });
    const pendingJobs = await Job.countDocuments({
      mistriId: mistri._id,
      status: { $in: ['assigned', 'in_progress'] }
    });

    res.json({
      success: true,
      data: {
        ...mistri.toObject(),
        stats: { totalJobs, completedJobs, pendingJobs }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create mistri
// @route POST /api/mistris
const createMistri = async (req, res, next) => {
  try {
    const { name, phone, email, skills, address, experience, dailyWage } = req.body;

    // Check existing phone
    const existing = await Mistri.findOne({ phone });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Mistri already exists with this phone'
      });
    }

    const mistri = await Mistri.create({
      name,
      phone,
      email,
      skills,
      address,
      experience,
      dailyWage
    });

    res.status(201).json({
      success: true,
      message: 'Mistri created',
      data: mistri
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update mistri
// @route PUT /api/mistris/:id
const updateMistri = async (req, res, next) => {
  try {
    let mistri = await Mistri.findById(req.params.id);

    if (!mistri) {
      return res.status(404).json({
        success: false,
        message: 'Mistri not found'
      });
    }

    mistri = await Mistri.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Mistri updated',
      data: mistri
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete / Deactivate mistri
// @route DELETE /api/mistris/:id
const deleteMistri = async (req, res, next) => {
  try {
    const mistri = await Mistri.findById(req.params.id);

    if (!mistri) {
      return res.status(404).json({
        success: false,
        message: 'Mistri not found'
      });
    }

    mistri.isActive = false;
    mistri.isAvailable = false;
    await mistri.save();

    if (mistri.userId) {
      await User.findByIdAndUpdate(mistri.userId, { isActive: false });
    }

    res.json({
      success: true,
      message: 'Mistri deactivated'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get available mistris
// @route GET /api/mistris/available/list
const getAvailableMistris = async (req, res, next) => {
  try {
    const { skill } = req.query;
    let query = { isAvailable: true, isActive: true };

    if (skill) {
      query.skills = { $in: [skill] };
    }

    const mistris = await Mistri.find(query).sort({ rating: -1 });

    res.json({
      success: true,
      data: mistris
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMistris,
  getMistri,
  createMistri,
  updateMistri,
  deleteMistri,
  getAvailableMistris
};