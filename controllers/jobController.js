const Job = require('../models/Job');
const { success, error } = require('../utils/response');

const createJob = async (req, res) => {
  try {
    const job = await Job.create({ ...req.body, customer: req.user.id });
    return success(res, 'Job created', job, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ status: 'open' }).populate('customer', 'name phone');
    return success(res, 'Jobs found', jobs);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('customer', 'name phone');
    if (!job) return error(res, 'Job not found', 404);
    return success(res, 'Job found', job);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const deleteJob = async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    return success(res, 'Job deleted');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { createJob, getAllJobs, getJobById, deleteJob };