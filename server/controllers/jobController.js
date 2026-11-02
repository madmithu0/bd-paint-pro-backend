const Job = require('../models/Job');
const Customer = require('../models/Customer');
const Mistri = require('../models/Mistri');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');

// @desc Get all jobs
// @route GET /api/jobs
const getJobs = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, customerId, mistriId, search } = req.query;

    let query = {};

    if (status) query.status = status;
    if (customerId) query.customerId = customerId;
    if (mistriId) query.mistriId = mistriId;

    if (search) {
      query.$or = [
        { jobNumber: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    const jobs = await Job.find(query)
      .populate('customerId', 'name phone')
      .populate('mistriId', 'name phone skills')
      .populate('serviceId', 'name price category')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Job.countDocuments(query);

    res.json({
      success: true,
      data: jobs,
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

// @desc Get single job
// @route GET /api/jobs/:id
const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('customerId')
      .populate('mistriId')
      .populate('serviceId')
      .populate('materials.materialId');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create job
// @route POST /api/jobs
const createJob = async (req, res, next) => {
  try {
    const { customerId, serviceId, description, address, scheduledDate, totalAmount, materials } = req.body;

    // Generate job number
    const lastJob = await Job.findOne().sort({ createdAt: -1 });
    const jobNumber = lastJob ? `JOB-${parseInt(lastJob.jobNumber.split('-')[1]) + 1}` : 'JOB-1001';

    const job = await Job.create({
      jobNumber,
      customerId,
      serviceId,
      description,
      address,
      scheduledDate,
      totalAmount,
      materials,
      status: 'pending',
      createdBy: req.user._id
    });

    // Create transaction
    if (totalAmount) {
      await Transaction.create({
        jobId: job._id,
        customerId,
        type: 'income',
        category: 'service_charge',
        amount: totalAmount,
        status: 'pending',
        createdBy: req.user._id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Job created',
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update job
// @route PUT /api/jobs/:id
const updateJob = async (req, res, next) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    job = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Job updated',
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc Assign mistri
// @route PUT /api/jobs/:id/assign
const assignMistri = async (req, res, next) => {
  try {
    const { mistriId } = req.body;

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const mistri = await Mistri.findById(mistriId);
    if (!mistri) {
      return res.status(404).json({ success: false, message: 'Mistri not found' });
    }

    if (!mistri.isAvailable) {
      return res.status(400).json({ success: false, message: 'Mistri is not available' });
    }

    job.mistriId = mistriId;
    job.status = 'assigned';
    job.assignedAt = Date.now();
    await job.save();

    mistri.isAvailable = false;
    await mistri.save();

    res.json({
      success: true,
      message: 'Mistri assigned',
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update job status
// @route PUT /api/jobs/:id/status
const updateJobStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = status;

    if (status === 'in_progress') job.startedAt = Date.now();
    if (status === 'completed') {
      job.completedAt = Date.now();
      // Make mistri available again
      if (job.mistriId) {
        await Mistri.findByIdAndUpdate(job.mistriId, { isAvailable: true });
      }
    }

    await job.save();

    res.json({
      success: true,
      message: `Job ${status}`,
      data: job
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getJobs,
  getJob,
  createJob,
  updateJob,
  assignMistri,
  updateJobStatus
};