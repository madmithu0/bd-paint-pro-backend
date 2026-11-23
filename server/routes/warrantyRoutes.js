const express = require('express');
const crypto = require('crypto');
const Warranty = require('../models/Warranty');
const Job = require('../models/Job');
const { verifyToken } = require('../middleware/authMiddleware');
const { superAdminGate } = require('../middleware/adminMiddleware');

const router = express.Router();

// 1. Public QR Verification Endpoint (No Auth Required)
router.get('/verify/:token', async (req, res, next) => {
  try {
    const cleanToken = String(req.params.token || '').trim();
    if (!cleanToken) {
      return res.status(400).json({
        success: false,
        message: 'Valid warranty QR token is required.',
      });
    }

    const warranty = await Warranty.findOne({
      $or: [{ qrToken: cleanToken }, { certificateCode: cleanToken }],
    })
      .populate('customer', 'name')
      .lean();

    if (!warranty) {
      return res.status(404).json({
        success: false,
        message: 'Warranty certificate not found or invalid QR token.',
      });
    }

    return res.status(200).json({
      success: true,
      warranty: {
        certificateCode: warranty.certificateCode,
        qrToken: warranty.qrToken,
        customerName: warranty.customer?.name || 'Verified Client',
        durationYears: warranty.durationYears,
        issuedAt: warranty.issuedAt || warranty.createdAt,
        expiresAt: warranty.expiresAt,
        materialBatchRef: warranty.materialBatchRef || null,
        status: warranty.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 2. Issue Digital QR Warranty Certificate on Job Completion
router.post('/issue', verifyToken, async (req, res, next) => {
  try {
    const { jobId, durationYears = 1, materialBatchRef = '' } = req.body;
    const job = await Job.findById(jobId).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Associated job not found.',
      });
    }

    const years = Math.min(3, Math.max(1, Number(durationYears) || 1));
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + years);

    const qrToken = crypto.randomBytes(16).toString('hex');
    const certificateCode = `WRN-${Date.now().toString().slice(-6)}-${crypto
      .randomInt(100, 999)}`;

    const warranty = await Warranty.create({
      job: job._id,
      customer: job.customer,
      certificateCode,
      qrToken,
      durationYears: years,
      issuedAt,
      expiresAt,
      materialBatchRef,
      status: 'Active',
    });

    return res.status(201).json({
      success: true,
      warranty,
    });
  } catch (error) {
    next(error);
  }
});

// 3. Super Admin Warranty List
router.get('/super/all', verifyToken, superAdminGate, async (req, res, next) => {
  try {
    const list = await Warranty.find({})
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.status(200).json({
      success: true,
      count: list.length,
      warranties: list,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
