const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { requireRole } = require('../middleware/authMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');
const advancePaymentGate = require('../middleware/advancePaymentGate');

const safeRequire = (path) => {
  try {
    return require(path);
  } catch (err) {
    return null;
  }
};

const ServiceCategory = safeRequire('../models/ServiceCategory');
const dialectVoiceEngine = safeRequire('../services/ai/dialectVoiceEngine');
const aiMeasureUtils = safeRequire('../utils/aiMeasureUtils');
const midJobAddOnEngine = safeRequire('../services/midJobAddOnEngine');

const handleMediaUpload =
  uploadMiddleware.uploadJobMedia ||
  uploadMiddleware.array?.('media', 5) ||
  ((req, res, next) => next());

const maskPhoneBeforeAdvance =
  advancePaymentGate.maskMistriPhoneMiddleware ||
  advancePaymentGate ||
  ((req, res, next) => next());

router.post('/calculate-days', (req, res) => {
  const { sqft, mistriCount = 1, slotSqftPerDay = 450, coatMultiplier = 1 } = req.body;
  const numericSqft = Number(sqft);

  if (!numericSqft || numericSqft <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid square feet (Sqft) is required.',
    });
  }

  const capacity = Math.max(1, Number(slotSqftPerDay));
  const multiplier = Math.max(0.5, Number(coatMultiplier));
  const calculatedSlots = Number(((numericSqft * multiplier) / capacity).toFixed(2));
  const effectiveMistri = Math.max(1, Number(mistriCount));
  const adjustedDays = Number((calculatedSlots / effectiveMistri).toFixed(2));

  return res.status(200).json({
    success: true,
    sqft: numericSqft,
    slotSqftPerDay: capacity,
    coatMultiplier: multiplier,
    calculatedSlots,
    baseDays: calculatedSlots,
    mistriCount: effectiveMistri,
    adjustedDays,
  });
});

router.post('/calculate-slots', async (req, res, next) => {
  try {
    const { items = [], mistriCount = 1 } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Service items array is required.' });
    }

    let totalSqft = 0;
    let totalSlots = 0;
    const breakdown = [];

    for (const item of items) {
      const sqft = Math.max(0, Number(item.sqft || 0));
      let slotCapacity = Number(item.slotSqftPerDay || 450);
      let coatMult = Number(item.coatMultiplier || 1);

      if (item.serviceId && ServiceCategory) {
        const cat = await ServiceCategory.findById(item.serviceId).lean().catch(() => null);
        if (cat) {
          slotCapacity = cat.slotSqftPerDay || slotCapacity;
          const coats = Number(item.coatCount || cat.defaultCoats || 2);
          coatMult = coats > 1 ? 1 + (coats - 1) * (cat.perCoatRateMultiplier || 0.4) : 1;
        }
      }

      const slots = Number(((sqft * coatMult) / Math.max(1, slotCapacity)).toFixed(2));
      totalSqft += sqft;
      totalSlots += slots;
      breakdown.push({ serviceId: item.serviceId, sqft, calculatedSlots: slots });
    }

    const effectiveMistri = Math.max(1, Number(mistriCount));
    return res.status(200).json({
      success: true,
      totalSqft,
      totalSlots: Number(totalSlots.toFixed(2)),
      estimatedDays: Number((totalSlots / effectiveMistri).toFixed(2)),
      breakdown,
    });
  } catch (error) {
    next(error);
  }
});
router.post('/analyze-media', handleMediaUpload, async (req, res, next) => {
  try {
    const { mediaType, mediaUrl, dialectText, district } = req.body;
    let voiceResult = null;
    let visionResult = null;

    if ((mediaType === 'voice' || dialectText) && dialectVoiceEngine) {
      const parseFn = dialectVoiceEngine.processVoiceOrder || dialectVoiceEngine.extractDialectIntent;
      if (parseFn) {
        voiceResult = await parseFn({ audioUrl: mediaUrl, text: dialectText, district });
      }
    }

    if ((mediaType === 'photo' || mediaType === 'video') && aiMeasureUtils) {
      const measureFn = aiMeasureUtils.analyzeWallMedia || aiMeasureUtils.measureFromPhoto;
      if (measureFn) {
        visionResult = await measureFn({ mediaType, mediaUrl });
      }
    }

    return res.status(200).json({
      success: true,
      mediaType: mediaType || 'text',
      voiceResult,
      visionResult,
      message: 'Multi-modal AI Sqft & slot analysis completed.',
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  requireRole(['Customer', 'Agent', 'Merchant']),
  handleMediaUpload,
  jobController.createJob
);

router.get('/', jobController.getJobList);

router.get('/:id', maskPhoneBeforeAdvance, jobController.getJobDetails);

router.patch(
  '/:id/add-service',
  requireRole(['Customer', 'Agent', 'Merchant', 'SuperAdmin']),
  async (req, res, next) => {
    try {
      if (jobController.addMidJobService) {
        return jobController.addMidJobService(req, res, next);
      }

      if (midJobAddOnEngine) {
        const engineFn =
          midJobAddOnEngine.appendMidJobService ||
          midJobAddOnEngine.processMidJobAddOn ||
          midJobAddOnEngine;
        if (typeof engineFn === 'function') {
          const result = await engineFn({
            jobId: req.params.id,
            userId: req.user._id || req.user.id,
            userRole: req.user.role,
            ...req.body,
          });
          return res.status(200).json({
            success: true,
            message: 'Mid-job add-on service appended and supplementary 30% escrow calculated.',
            ...result,
          });
        }
      }

      return res.status(501).json({
        success: false,
        message: 'Mid-job add-on handler is not configured yet.',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/:id/assign',
  requireRole(['Customer', 'Agent', 'Merchant', 'SuperAdmin']),
  jobController.assignJob
);

router.patch('/:id/status', jobController.updateJobStatus);

module.exports = router;
