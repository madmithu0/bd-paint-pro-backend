const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Job = require('../models/Job');

// @route   POST /api/v1/invoices
// @desc    Create an Invoice for a Job with Share Breakup
// @access  Protected
router.post('/', async (req, res, next) => {
  try {
    const { jobId, amount, pdfUrl } = req.body;
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const totalAmount = Number(amount) || job.price;
    const hasAgent = Boolean(job.agent);

    const shareBreakup = {
      mistriShare: Number((totalAmount * 0.80).toFixed(2)),
      agentShare: hasAgent ? Number((totalAmount * 0.05).toFixed(2)) : 0,
      platformShare: hasAgent
        ? Number((totalAmount * 0.15).toFixed(2))
        : Number((totalAmount * 0.20).toFixed(2)),
      isMistriOnly: Boolean(job.isMistriOnly),
    };

    const invoice = await Invoice.create({
      job: job._id,
      user: req.user.id,
      invoiceNumber: `INV-${Date.now()}`,
      amount: totalAmount,
      pdfUrl: pdfUrl || '',
      shareBreakup,
    });

    res.status(201).json({
      success: true,
      invoice,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/invoices
// @desc    Get User Invoice List
// @access  Protected
router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.role === 'SuperAdmin' ? {} : { user: req.user.id };
    const invoices = await Invoice.find(filter)
      .populate('job', 'sqft status isMistriOnly')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/invoices/:id/download
// @desc    Get Invoice Download Details
// @access  Protected
router.get('/:id/download', async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('job').lean();
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    res.status(200).json({
      success: true,
      downloadReady: true,
      invoice,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
