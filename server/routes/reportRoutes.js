const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const Report = require('../models/Report');
const { requireRole } = require('../middleware/authMiddleware');

// @route   GET /api/v1/reports/jobs
// @desc    Generate Job Summary Report
// @access  Protected
router.get('/jobs', async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (req.user.role !== 'SuperAdmin') {
      filter.$or = [{ customer: req.user.id }, { assignedMistri: req.user.id }, { agent: req.user.id }];
    }

    const jobs = await Job.find(filter).sort({ createdAt: -1 }).lean();
    const totalSqft = jobs.reduce((sum, j) => sum + (j.sqft || 0), 0);
    const totalAmount = jobs.reduce((sum, j) => sum + (j.price || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalJobs: jobs.length,
        totalSqft,
        totalAmount,
      },
      jobs,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/reports/payments
// @desc    Generate Payment & Share Breakup Report
// @access  Protected
router.get('/payments', async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter).sort({ createdAt: -1 }).lean();
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPlatformShare = payments.reduce((sum, p) => sum + (p.platformShareAmount || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalTransactions: payments.length,
        totalPaid,
        totalPlatformShare,
      },
      payments,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/reports/export
// @desc    Log & Export Report Snapshot
// @access  Protected (SuperAdmin / Merchant / Agent)
router.post('/export', requireRole(['SuperAdmin', 'Merchant', 'Agent']), async (req, res, next) => {
  try {
    const { type, data } = req.body;
    const savedReport = await Report.create({
      type: type || 'GENERAL_EXPORT',
      data: data || {},
      generatedBy: req.user.id,
      date: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Report exported and archived successfully.',
      report: savedReport,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
