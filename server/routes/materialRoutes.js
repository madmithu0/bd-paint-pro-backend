const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Material = require('../models/Material');
const Job = require('../models/Job');
const OTP = require('../models/OTP');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { requireRole } = require('../middleware/authMiddleware');

const safeRequire = (path) => {
  try {
    return require(path);
  } catch (err) {
    return null;
  }
};

const smsUtils = safeRequire('../utils/smsUtils');

router.post('/', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const {
      name,
      brand,
      grade,
      unit,
      unitPrice,
      price,
      bulkDiscountPrice,
      merchantCommissionRate,
      isDirectPurchaseEnabled,
      stock,
      description,
    } = req.body;

    const finalUnitPrice = unitPrice !== undefined ? Number(unitPrice) : Number(price);

    if (!name || Number.isNaN(finalUnitPrice) || finalUnitPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid material name and non-negative unit price are required.',
      });
    }

    const userId = req.user._id || req.user.id;
    const isSuperAdmin = req.user.role === 'SuperAdmin';

    const material = await Material.create({
      name: String(name).trim(),
      brand: brand ? String(brand).trim() : 'Standard',
      grade: grade ? String(grade).trim() : 'Standard',
      unit: unit || 'Liter',
      unitPrice: finalUnitPrice,
      price: finalUnitPrice,
      ...(bulkDiscountPrice !== undefined && { bulkDiscountPrice: Math.max(0, Number(bulkDiscountPrice)) }),
      merchantCommissionRate: merchantCommissionRate !== undefined ? Number(merchantCommissionRate) : 4,
      isDirectPurchaseEnabled: isDirectPurchaseEnabled !== undefined ? Boolean(isDirectPurchaseEnabled) : true,
      stock: Math.max(0, Number(stock) || 0),
      description: description ? String(description).trim() : '',
      merchantId: userId,
      merchant: userId,
      status: isSuperAdmin ? 'Approved' : 'Pending',
    });

    return res.status(201).json({
      success: true,
      material,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const isSuperAdmin = req.user && req.user.role === 'SuperAdmin';
    const filter = isSuperAdmin ? {} : { status: 'Approved' };
    if (req.query.brand) filter.brand = String(req.query.brand).trim();

    const materials = await Material.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: materials.length,
      materials,
    });
  } catch (error) {
    next(error);
  }
});
router.get('/:id', async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id).lean();
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }
    return res.status(200).json({ success: true, material });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const userId = String(req.user._id || req.user.id);
    const ownerId = String(material.merchantId || material.merchant);

    if (req.user.role === 'Merchant' && ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own materials.',
      });
    }

    const {
      name,
      brand,
      grade,
      unit,
      unitPrice,
      price,
      bulkDiscountPrice,
      isDirectPurchaseEnabled,
      stock,
      description,
    } = req.body;

    if (name !== undefined) material.name = String(name).trim();
    if (brand !== undefined) material.brand = String(brand).trim();
    if (grade !== undefined) material.grade = String(grade).trim();
    if (unit !== undefined) material.unit = unit;

    const updatedPrice = unitPrice !== undefined ? Number(unitPrice) : price !== undefined ? Number(price) : undefined;
    if (updatedPrice !== undefined && updatedPrice >= 0) {
      material.unitPrice = updatedPrice;
      material.price = updatedPrice;
    }

    if (bulkDiscountPrice !== undefined && Number(bulkDiscountPrice) >= 0) {
      material.bulkDiscountPrice = Number(bulkDiscountPrice);
    }
    if (isDirectPurchaseEnabled !== undefined) {
      material.isDirectPurchaseEnabled = Boolean(isDirectPurchaseEnabled);
    }
    if (stock !== undefined && Number(stock) >= 0) {
      material.stock = Number(stock);
    }
    if (description !== undefined) {
      material.description = String(description).trim();
    }

    await material.save();

    return res.status(200).json({ success: true, material });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/stock', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || Number(stock) < 0) {
      return res.status(400).json({ success: false, message: 'Valid non-negative stock quantity required.' });
    }

    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const userId = String(req.user._id || req.user.id);
    const ownerId = String(material.merchantId || material.merchant);

    if (req.user.role === 'Merchant' && ownerId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    material.stock = Number(stock);
    await material.save();

    return res.status(200).json({
      success: true,
      message: 'Material stock updated successfully.',
      material,
    });
  } catch (error) {
    next(error);
  }
});
router.post('/memo/request-otp', requireRole(['Mistri', 'Merchant', 'Agent']), async (req, res, next) => {
  try {
    const { jobId, materialCost, memoItems = [] } = req.body;
    const job = await Job.findById(jobId).populate('customerId', 'phone name');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const customerPhone = job.customerId?.phone || job.customerPhone;
    if (!customerPhone) {
      return res.status(400).json({ success: false, message: 'Customer phone number not found.' });
    }

    const otpCode = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.deleteMany({ phone: customerPhone, purpose: 'MATERIAL_MEMO_APPROVE', verified: false });
    await OTP.create({
      phone: customerPhone,
      code: otpCode,
      purpose: 'MATERIAL_MEMO_APPROVE',
      verified: false,
      expiresAt,
    });

    if (smsUtils?.sendSms) {
      await smsUtils.sendSms(
        customerPhone,
        `Material Memo Approval OTP for Job #${String(job._id).slice(-6)} (BDT ${materialCost}): ${otpCode}`
      ).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'Digital material memo approval OTP sent to customer.',
      memoSummary: { jobId: job._id, materialCost: Number(materialCost), itemCount: memoItems.length },
      ...(process.env.DEV_MODE === 'true' && { devOtp: otpCode }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/memo/approve', requireRole(['Customer', 'Mistri', 'Merchant']), async (req, res, next) => {
  try {
    const { jobId, otpCode, materialCost, memoItems = [] } = req.body;
    const job = await Job.findById(jobId).populate('customerId', 'phone');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const customerPhone = job.customerId?.phone || job.customerPhone;
    const otpRecord = await OTP.findOne({
      phone: customerPhone,
      code: String(otpCode || '').trim(),
      purpose: 'MATERIAL_MEMO_APPROVE',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired material memo OTP.' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    const memoPayload = JSON.stringify({ jobId: job._id, materialCost: Number(materialCost), memoItems });
    const digitalMemoHash = crypto.createHash('sha256').update(memoPayload).digest('hex');

    job.materialCost = Number(materialCost);
    job.materialMemoApproved = true;
    job.digitalMemoHash = digitalMemoHash;
    if (job.totalBill) {
      job.netProfit = Number((job.totalBill - job.materialCost).toFixed(2));
    }
    await job.save();

    await AuditLog.create({
      user: String(req.user._id || req.user.id),
      role: req.user.role,
      action: 'MATERIAL_MEMO_OTP_APPROVED',
      category: 'FINANCE',
      ipAddress: req.ip || '',
      details: { jobId: job._id, materialCost: job.materialCost, digitalMemoHash },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Digital material memo verified and approved via OTP.',
      digitalMemoHash,
      materialCost: job.materialCost,
      netProfit: job.netProfit,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const userId = String(req.user._id || req.user.id);
    const ownerId = String(material.merchantId || material.merchant);

    if (req.user.role === 'Merchant' && ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own materials.',
      });
    }

    await material.deleteOne();
    return res.status(200).json({ success: true, message: 'Material deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/approve', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid approval status.' });
    }

    const material = await Material.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Material ${status.toLowerCase()} successfully.`,
      material,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
