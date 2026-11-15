const crypto = require('crypto');
const Job = require('../models/Job');
const { calculateJobPriceAndDays } = require('../utils/priceUtils');

// 1. Create a New Paint / Wall Repair Job
const createJob = async (req, res, next) => {
  try {
    const {
      sqft,
      materialSource = 'Platform',
      isMistriOnly = false,
      wallProblem = ['None'],
      wallDamageLevel = 'Low',
      wallPhotos = [],
      agentId = null,
      mistriCount,
    } = req.body;

    const numericSqft = Number(sqft);
    if (!numericSqft || numericSqft <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid square feet (Sqft) is required.',
      });
    }

    const mistriOnlyFlag = Boolean(isMistriOnly) || materialSource === 'CustomerOwn';

    // Calculate price, repair cost (Nona/Damp/Fatol), days (Sqft/450), and auto mistri count
    const estimate = calculateJobPriceAndDays({
      sqft: numericSqft,
      isMistriOnly: mistriOnlyFlag,
      wallProblem,
      wallDamageLevel,
      requestedMistriCount: mistriCount,
    });

    const job = await Job.create({
      customer: req.user.id,
      agent: agentId || (req.user.role === 'Agent' ? req.user.id : null),
      sqft: numericSqft,
      price: estimate.totalPrice,
      materialSource: mistriOnlyFlag ? 'CustomerOwn' : materialSource,
      materialCost: estimate.materialCost,
      labourCost: estimate.labourCost,
      isMistriOnly: mistriOnlyFlag,
      totalDays: estimate.totalDays,
      mistriCount: estimate.mistriCount,
      wallProblem,
      wallDamageLevel,
      wallPhotos,
      startOtp: String(crypto.randomInt(1000, 9999)),
      endOtp: String(crypto.randomInt(1000, 9999)),
    });

    res.status(201).json({
      success: true,
      message: 'Job created successfully.',
      estimate,
      job,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Job List
const getJobList = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    if (req.user.role === 'Customer') filter.customer = req.user.id;
    else if (req.user.role === 'Mistri') filter.assignedMistri = req.user.id;
    else if (req.user.role === 'Agent') filter.agent = req.user.id;

    const skip = (Number(page) - 1) * Number(limit);
    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('customer', 'name phone')
        .populate('assignedMistri', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Job.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      jobs,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Single Job Details
const getJobDetails = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('customer', 'name phone')
      .populate('agent', 'name phone')
      .populate('assignedMistri', 'name phone')
      .populate('assignedTeam', 'teamName')
      .lean();

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    // Calculate exact BDT share breakup for display
    const mistriAmount = Number(((job.price * job.mistriSharePercent) / 100).toFixed(2));
    const agentAmount = Number(((job.price * job.agentSharePercent) / 100).toFixed(2));
    const platformAmount = Number(((job.price * job.platformSharePercent) / 100).toFixed(2));

    res.status(200).json({
      success: true,
      job,
      shareBreakup: {
        mistriAmount,
        agentAmount,
        platformAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Assign Mistri or Team to Job
const assignJob = async (req, res, next) => {
  try {
    const { mistriIds = [], teamId = null } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (mistriIds.length > 0) {
      job.assignedMistri = mistriIds;
      job.mistriCount = mistriIds.length;
    }
    if (teamId) {
      job.assignedTeam = teamId;
    }

    job.status = 'Assigned';
    await job.save(); // Triggers pre-save hook to recalculate totalDays = (Sqft / 450) / mistriCount

    res.status(200).json({
      success: true,
      message: 'Job assigned and schedule days recalculated.',
      job,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Update Job Status (with Start/End OTP Validation)
const updateJobStatus = async (req, res, next) => {
  try {
    const { status, otp, cancelReason } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (status === 'In-Progress') {
      if (otp && String(otp) !== job.startOtp) {
        return res.status(400).json({ success: false, message: 'Invalid Job Start OTP.' });
      }
      job.startedAt = new Date();
    }

    if (status === 'Completed') {
      if (otp && String(otp) !== job.endOtp) {
        return res.status(400).json({ success: false, message: 'Invalid Job Completion OTP.' });
      }
      job.completedAt = new Date();
    }

    if (status === 'Cancelled') {
      job.cancelReason = cancelReason || 'Cancelled by user';
    }

    job.status = status;
    await job.save();

    res.status(200).json({
      success: true,
      message: `Job status updated to ${status}.`,
      job,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createJob,
  getJobList,
  getJobDetails,
  assignJob,
  updateJobStatus,
};
