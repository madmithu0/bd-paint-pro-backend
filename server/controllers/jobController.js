const crypto = require('crypto');
const Job = require('../models/Job');
const User = require('../models/User');
const ServiceCategory = require('../models/ServiceCategory');
const { calculateJobPriceAndDays } = require('../utils/priceUtils');
const { maskMistriContactIfUnpaid } = require('../middleware/advancePaymentGate');

const createJob = async (req, res, next) => {
  try {
    const {
      selectedServices = [],
      sqft,
      materialSource = 'Platform',
      isMistriOnly = false,
      isSiteVisitRequested = false,
      wallProblem = ['None'],
      wallDamageLevel = 'Low',
      wallPhotos = [],
      agentId = null,
      mistriCount,
    } = req.body;

    let resolvedServices = [];
    let numericSqft = Number(sqft) || 0;
    let totalBill = 0;
    let totalMaterialCost = 0;
    let totalLabourCost = 0;
    let totalSlots = 0;
    let allMistriOnly = Boolean(isMistriOnly) || materialSource === 'CustomerOwn';

    if (Array.isArray(selectedServices) && selectedServices.length > 0) {
      const serviceIds = selectedServices.map((item) => item.serviceId);
      const dbCategories = await ServiceCategory.find({
        _id: { $in: serviceIds },
        isActive: true,
      });

      const categoryMap = new Map(
        dbCategories.map((cat) => [String(cat._id), cat])
      );

      allMistriOnly = true;
      numericSqft = 0;

      for (const item of selectedServices) {
        const cat = categoryMap.get(String(item.serviceId));
        if (!cat) {
          return res.status(400).json({
            success: false,
            message: 'One or more selected services are currently unavailable.',
          });
        }

        const itemMistriOnly = Boolean(item.isMistriOnly);
        if (itemMistriOnly && !cat.isLabourOnlyEnabled) {
          return res.status(400).json({
            success: false,
            message: `Labour-only option is disabled for ${cat.name}.`,
          });
        }
        if (!itemMistriOnly && !cat.isWithMaterialEnabled) {
          return res.status(400).json({
            success: false,
            message: `With-material option is disabled for ${cat.name}.`,
          });
        }

        const est = cat.calculateEstimate(item.sqft, itemMistriOnly);
        if (est.sqft <= 0) {
          return res.status(400).json({
            success: false,
            message: `Valid Sqft is required for ${cat.name}.`,
          });
        }

        resolvedServices.push({
          serviceId: cat._id,
          code: cat.code,
          name: cat.name,
          sqft: est.sqft,
          isMistriOnly: itemMistriOnly,
          slotSqftPerDay: cat.slotSqftPerDay,
          calculatedSlots: est.calculatedSlots,
          appliedRate: est.appliedRate,
          subTotal: est.subTotal,
          estimatedMaterialCost: est.estimatedMaterialCost,
        });

        numericSqft += est.sqft;
        totalSlots += est.calculatedSlots;
        totalBill += est.subTotal;
        totalMaterialCost += est.estimatedMaterialCost;
        totalLabourCost += est.subTotal - est.estimatedMaterialCost;
        if (!itemMistriOnly) allMistriOnly = false;
      }
    } else {
      if (!numericSqft || numericSqft <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid square feet (Sqft) or service checklist is required.',
        });
      }
      const legacyEstimate = calculateJobPriceAndDays({
        sqft: numericSqft,
        isMistriOnly: allMistriOnly,
        wallProblem,
        wallDamageLevel,
        requestedMistriCount: mistriCount,
      });

      totalBill = legacyEstimate.totalPrice;
      totalMaterialCost = legacyEstimate.materialCost;
      totalLabourCost = legacyEstimate.labourCost;
      totalSlots = legacyEstimate.totalDays;
    }

    const finalMistriCount = Math.max(1, Number(mistriCount) || Math.ceil(totalSlots / 5) || 1);
    const calculatedDays = Number((totalSlots / finalMistriCount).toFixed(2));

    const job = await Job.create({
      customer: req.user.id,
      agent: agentId || (req.user.role === 'Agent' ? req.user.id : null),
      selectedServices: resolvedServices,
      sqft: numericSqft,
      price: totalBill,
      materialSource: allMistriOnly ? 'CustomerOwn' : materialSource,
      materialCost: totalMaterialCost,
      labourCost: totalLabourCost,
      isMistriOnly: allMistriOnly,
      totalSlots: Number(totalSlots.toFixed(2)),
      totalDays: calculatedDays,
      mistriCount: finalMistriCount,
      isSiteVisitRequested: Boolean(isSiteVisitRequested),
      siteVisitStatus: isSiteVisitRequested ? 'Requested' : 'None',
      wallProblem,
      wallDamageLevel,
      wallPhotos,
      startOtp: String(crypto.randomInt(1000, 9999)),
      endOtp: String(crypto.randomInt(1000, 9999)),
    });

    const estimate = {
      totalSqft: numericSqft,
      totalSlots: Number(totalSlots.toFixed(2)),
      totalDays: calculatedDays,
      mistriCount: finalMistriCount,
      totalPrice: totalBill,
      materialCost: totalMaterialCost,
      labourCost: totalLabourCost,
      netProfit: job.netProfit,
      advance30Percent: job.milestoneStages.stage1Amount,
    };

    return res.status(201).json({
      success: true,
      message: 'Job created successfully.',
      estimate,
      job,
    });
  } catch (error) {
    next(error);
  }
};

const getJobList = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    if (req.user.role === 'Customer') filter.customer = req.user.id;
    else if (req.user.role === 'Mistri') filter.assignedMistri = req.user.id;
    else if (req.user.role === 'Agent') filter.agent = req.user.id;

    const skip = (Number(page) - 1) * Number(limit);
    const [rawJobs, total] = await Promise.all([
      Job.find(filter)
        .populate('customer', 'name phone profilePhoto')
        .populate('assignedMistri', 'name phone profilePhoto qualityScore')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Job.countDocuments(filter),
    ]);

    const jobs = rawJobs.map((j) => {
      const isAdvancePaid = Boolean(j.milestoneStages && j.milestoneStages.stage1Paid);
      if (Array.isArray(j.assignedMistri)) {
        j.assignedMistri = j.assignedMistri.map((m) =>
          maskMistriContactIfUnpaid(m, isAdvancePaid)
        );
      }
      return j;
    });

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      jobs,
    });
  } catch (error) {
    next(error);
  }
};
const getJobDetails = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('customer', 'name phone profilePhoto')
      .populate('agent', 'name phone')
      .populate('assignedMistri', 'name phone profilePhoto qualityScore')
      .populate('assignedTeam', 'teamName')
      .lean();

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const isAdvancePaid = Boolean(
      job.milestoneStages && job.milestoneStages.stage1Paid
    );

    if (Array.isArray(job.assignedMistri)) {
      job.assignedMistri = job.assignedMistri.map((m) =>
        maskMistriContactIfUnpaid(m, isAdvancePaid)
      );
    }

    const baseNetProfit = Math.max(0, job.price - (job.materialCost || 0));
    const mistriAmount = Number(((baseNetProfit * job.mistriSharePercent) / 100).toFixed(2));
    const agentAmount = Number(((baseNetProfit * job.agentSharePercent) / 100).toFixed(2));
    const platformAmount = Number(((baseNetProfit * job.platformSharePercent) / 100).toFixed(2));

    return res.status(200).json({
      success: true,
      advance30Unlocked: isAdvancePaid,
      job,
      shareBreakup: {
        netProfit: baseNetProfit,
        mistriAmount,
        agentAmount,
        platformAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

const assignJob = async (req, res, next) => {
  try {
    const { mistriIds = [], teamId = null } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (mistriIds.length > 0) {
      const validMistris = await User.find({
        _id: { $in: mistriIds },
        role: 'Mistri',
        active: true,
        suspended: false,
      }).select('_id');

      if (validMistris.length !== mistriIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected Mistris are inactive or suspended.',
        });
      }

      job.assignedMistri = mistriIds;
      job.mistriCount = mistriIds.length;
    }

    if (teamId) {
      job.assignedTeam = teamId;
    }

    job.status = 'Assigned';
    await job.save();

    return res.status(200).json({
      success: true,
      message: 'Job assigned and schedule days recalculated.',
      job,
    });
  } catch (error) {
    next(error);
  }
};

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

    return res.status(200).json({
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
