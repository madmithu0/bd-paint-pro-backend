
const express = require('express');
const mongoose = require('mongoose');
const ServiceCategory = require('../models/ServiceCategory');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/authMiddleware');
const { superAdminGate } = require('../middleware/adminMiddleware');

console.log('CHECK MIDDLEWARE:', {
  verifyToken: typeof verifyToken,
  superAdminGate: typeof superAdminGate,
});

const router = express.Router();

const emitServiceUpdate = (req, payload) => {
  const io = req.app.get('io');
  if (io) {
    io.emit('service_catalog_updated', payload);
  }
};

router.get('/', async (req, res, next) => {
  try {
    const services = await ServiceCategory.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/super/all', verifyToken, superAdminGate, async (req, res, next) => {
  try {
    const services = await ServiceCategory.find({})
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/estimate', async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one service item is required for estimation',
      });
    }

    const serviceIds = items.map((item) => item.serviceId);
    const categories = await ServiceCategory.find({
      _id: { $in: serviceIds },
      isActive: true,
    });

    const categoryMap = new Map(
      categories.map((cat) => [cat._id.toString(), cat])
    );

    let totalSqft = 0;
    let totalSlots = 0;
    let totalBill = 0;
    let totalMaterialCost = 0;
    const breakdown = [];

    for (const item of items) {
      const cat = categoryMap.get(String(item.serviceId));
      if (!cat) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected services are inactive or invalid',
        });
      }

      const isMistriOnly = Boolean(item.isMistriOnly);
      if (isMistriOnly && !cat.isLabourOnlyEnabled) {
        return res.status(400).json({
          success: false,
          message: `Labour-only option is disabled for ${cat.name}`,
        });
      }
      if (!isMistriOnly && !cat.isWithMaterialEnabled) {
        return res.status(400).json({
          success: false,
          message: `With-material option is disabled for ${cat.name}`,
        });
      }

      const est = cat.calculateEstimate(item.sqft, isMistriOnly);
      totalSqft += est.sqft;
      totalSlots += est.calculatedSlots;
      totalBill += est.subTotal;
      totalMaterialCost += est.estimatedMaterialCost;
      breakdown.push(est);
    }

    const roundedSlots = Number(totalSlots.toFixed(2));
    const estimatedDays = Math.max(1, Math.ceil(roundedSlots));
    const netProfit = totalBill - totalMaterialCost;
    const advance30Percent = Math.round(totalBill * 0.3);

    return res.status(200).json({
      success: true,
      summary: {
        totalSqft,
        totalSlots: roundedSlots,
        estimatedDays,
        totalBill,
        totalMaterialCost,
        netProfit,
        advance30Percent,
      },
      breakdown,
    });
  } catch (error) {
    next(error);
  }
});
router.patch('/mistri/skills', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'Mistri') {
      return res.status(403).json({
        success: false,
        message: 'Only registered Mistris can update service skills',
      });
    }

    const { serviceIds } = req.body;
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one service category',
      });
    }

    const validIds = serviceIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    const activeServices = await ServiceCategory.find({
      _id: { $in: validIds },
      isActive: true,
    }).select('_id');

    const approvedIds = activeServices.map((s) => s._id);
    await User.findByIdAndUpdate(req.user.id, {
      $set: { capableServices: approvedIds },
    });

    return res.status(200).json({
      success: true,
      message: 'Mistri service skills updated successfully',
      capableServices: approvedIds,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/super/:id/update',
  verifyToken,
  superAdminGate,
  async (req, res, next) => {
    try {
      const {
        name,
        applicationArea,
        slotSqftPerDay,
        labourRatePerSqft,
        withMaterialRatePerSqft,
        isActive,
        isLabourOnlyEnabled,
        isWithMaterialEnabled,
        disabledReason,
      } = req.body;

      const service = await ServiceCategory.findById(req.params.id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service category not found',
        });
      }

      if (name !== undefined) service.name = name;
      if (applicationArea !== undefined) service.applicationArea = applicationArea;
      if (slotSqftPerDay !== undefined) service.slotSqftPerDay = Number(slotSqftPerDay);
      if (labourRatePerSqft !== undefined) service.labourRatePerSqft = Number(labourRatePerSqft);
      if (withMaterialRatePerSqft !== undefined) service.withMaterialRatePerSqft = Number(withMaterialRatePerSqft);
      if (typeof isActive === 'boolean') service.isActive = isActive;
      if (typeof isLabourOnlyEnabled === 'boolean') service.isLabourOnlyEnabled = isLabourOnlyEnabled;
      if (typeof isWithMaterialEnabled === 'boolean') service.isWithMaterialEnabled = isWithMaterialEnabled;
      if (disabledReason !== undefined) service.disabledReason = disabledReason;
      service.updatedBy = req.user.id;

      await service.save();

      await AuditLog.create({
        user: req.user.id,
        action: `SUPER_ADMIN_SERVICE_UPDATE:${service.code}`,
        ip: req.ip,
      }).catch(() => {});

      emitServiceUpdate(req, { action: 'UPDATED', service });

      return res.status(200).json({
        success: true,
        message: 'Service rate and visibility updated',
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/super/create', verifyToken, superAdminGate, async (req, res, next) => {
  try {
    const newService = await ServiceCategory.create({
      ...req.body,
      updatedBy: req.user.id,
    });

    emitServiceUpdate(req, { action: 'CREATED', service: newService });

    return res.status(201).json({
      success: true,
      data: newService,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
