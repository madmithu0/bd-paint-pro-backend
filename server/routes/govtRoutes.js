const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { requireRole } = require('../middleware/authMiddleware');
const { verifyNbrBin, calculateMushakVat } = require('../utils/govtUtils');

// @route   POST /api/v1/govt/verify-bin
// @desc    Verify Merchant / Company BIN with NBR API
// @access  Protected (Merchant / SuperAdmin)
router.post('/verify-bin', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const { binNumber, companyName } = req.body;
    if (!binNumber) {
      return res.status(400).json({ success: false, message: 'NBR BIN number is required.' });
    }

    const verification = await verifyNbrBin(binNumber, companyName);
    res.status(200).json({
      success: true,
      verification,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/govt/mushak-vat
// @desc    Calculate Mushak VAT & Generate Govt Tax Summary
// @access  Protected (Merchant / SuperAdmin)
router.post('/mushak-vat', requireRole(['Merchant', 'SuperAdmin']), (req, res) => {
  const { amount, vatRate = 15 } = req.body;
  const numericAmount = Number(amount);

  if (!numericAmount || numericAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Valid taxable amount is required.' });
  }

  const taxData = calculateMushakVat(numericAmount, Number(vatRate));
  res.status(200).json({
    success: true,
    mushakForm: 'Mushak-6.3',
    ...taxData,
  });
});

// @route   POST /api/v1/govt/police-report
// @desc    Create Formal Police Incident / Fraud Report for Major Disputes
// @access  Protected (SuperAdmin)
router.post('/police-report', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { jobId, accusedUserId, incidentDetails, evidenceLinks = [] } = req.body;

    if (!incidentDetails) {
      return res.status(400).json({ success: false, message: 'Incident details are required.' });
    }

    const policeReport = await Report.create({
      type: 'GOVT_POLICE_REPORT',
      data: {
        jobId,
        accusedUserId,
        incidentDetails,
        evidenceLinks,
        btrcCompliant: true,
        generatedAt: new Date().toISOString(),
      },
      generatedBy: req.user.id,
      date: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Official Police Report dossier generated and archived.',
      report: policeReport,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/govt/reports
// @desc    List All Govt Compliance & Police Reports
// @access  Protected (SuperAdmin)
router.get('/reports', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const reports = await Report.find({ type: { $in: ['GOVT_POLICE_REPORT', 'NBR_VAT_AUDIT'] } })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
