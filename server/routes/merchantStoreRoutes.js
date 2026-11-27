const express = require('express');
const router = express.Router();
const Material = require('../models/Material');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const AuditLog = require('../models/AuditLog');
const { requireRole } = require('../middleware/authMiddleware');

const safeRequire = (path) => {
  try {
    return require(path);
  } catch (err) {
    return null;
  }
};

const MaterialOrder = safeRequire('../models/MaterialOrder');

router.get('/catalog', async (req, res, next) => {
  try {
    const { brand, district, upazila, search } = req.query;
    const filter = { isDirectPurchaseEnabled: true, stock: { $gt: 0 } };

    if (brand) filter.brand = String(brand).trim();
    if (search) filter.name = { $regex: String(search).trim(), $options: 'i' };

    let merchantIds = null;
    if (district || upazila) {
      const merchantQuery = { role: 'Merchant', accountStatus: 'Active' };
      if (district) merchantQuery.district = String(district).trim();
      if (upazila) merchantQuery.upazila = String(upazila).trim();
      const localMerchants = await User.find(merchantQuery).select('_id').lean();
      merchantIds = localMerchants.map((m) => m._id);
      filter.merchantId = { $in: merchantIds };
    }

    const materials = await Material.find(filter)
      .populate('merchantId', 'name district upazila phone')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: materials.length,
      materials,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/checkout', requireRole(['Customer', 'Mistri', 'Agent']), async (req, res, next) => {
  try {
    const buyerId = req.user._id || req.user.id;
    const { items = [], deliveryAddress, district, upazila, isBulkOrder = false } = req.body;

    if (!Array.isArray(items) || items.length === 0 || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: 'Order items and delivery address are required.',
      });
    }

    let totalAmount = 0;
    let totalPlatformCommission = 0;
    const processedItems = [];
    let routedMerchantId = null;

    for (const item of items) {
      const mat = await Material.findById(item.materialId);
      const qty = Math.max(1, Number(item.quantity || 1));

      if (!mat || mat.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for material: ${mat?.name || item.materialId}`,
        });
      }

      const unitRate = isBulkOrder && mat.bulkDiscountPrice ? mat.bulkDiscountPrice : mat.unitPrice;
      const lineTotal = Number((unitRate * qty).toFixed(2));
      const commRate = Number(mat.merchantCommissionRate || 4) / 100;
      const lineCommission = Number((lineTotal * commRate).toFixed(2));

      totalAmount += lineTotal;
      totalPlatformCommission += lineCommission;
      if (!routedMerchantId && mat.merchantId) routedMerchantId = mat.merchantId;

      mat.stock -= qty;
      await mat.save();

      processedItems.push({
        materialId: mat._id,
        name: mat.name,
        brand: mat.brand,
        quantity: qty,
        unitPrice: unitRate,
        subTotal: lineTotal,
      });
    }
    if (!routedMerchantId && (district || upazila)) {
      const localMerchant = await User.findOne({
        role: 'Merchant',
        accountStatus: 'Active',
        ...(upazila ? { upazila } : { district }),
      }).lean();
      if (localMerchant) routedMerchantId = localMerchant._id;
    }

    const merchantNetPayable = Number((totalAmount - totalPlatformCommission).toFixed(2));
    let orderDoc = null;

    if (MaterialOrder) {
      orderDoc = await MaterialOrder.create({
        buyerId,
        merchantId: routedMerchantId,
        items: processedItems,
        totalAmount,
        platformCommission: totalPlatformCommission,
        merchantNetPayable,
        isBulkOrder: Boolean(isBulkOrder),
        deliveryAddress: String(deliveryAddress).trim(),
        district: district || '',
        upazila: upazila || '',
        deliveryStatus: 'Pending',
      });
    }

    await AuditLog.create({
      user: String(buyerId),
      role: req.user.role,
      action: 'DIRECT_MATERIAL_ORDER_PLACED',
      category: 'STORE',
      ipAddress: req.ip || '',
      details: { orderId: orderDoc?._id, totalAmount, routedMerchantId },
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Material order placed and routed to verified local merchant.',
      order: orderDoc || {
        items: processedItems,
        totalAmount,
        platformCommission: totalPlatformCommission,
        merchantNetPayable,
        routedMerchantId,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/inventory/sync', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const merchantId = req.user._id || req.user.id;
    const { updates = [] } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Inventory updates array is required.' });
    }

    const updatedList = [];
    for (const entry of updates) {
      const query = { _id: entry.materialId };
      if (req.user.role === 'Merchant') query.merchantId = merchantId;

      const updated = await Material.findOneAndUpdate(
        query,
        {
          $set: {
            ...(entry.stock !== undefined && { stock: Math.max(0, Number(entry.stock)) }),
            ...(entry.unitPrice !== undefined && { unitPrice: Math.max(0, Number(entry.unitPrice)) }),
            ...(entry.bulkDiscountPrice !== undefined && {
              bulkDiscountPrice: Math.max(0, Number(entry.bulkDiscountPrice)),
            }),
            ...(entry.isDirectPurchaseEnabled !== undefined && {
              isDirectPurchaseEnabled: Boolean(entry.isDirectPurchaseEnabled),
            }),
          },
        },
        { new: true }
      );
      if (updated) updatedList.push(updated);
    }

    return res.status(200).json({
      success: true,
      message: 'Merchant inventory synced successfully.',
      updatedCount: updatedList.length,
      materials: updatedList,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/ledger', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const targetMerchantId =
      req.user.role === 'SuperAdmin' && req.query.merchantId
        ? req.query.merchantId
        : req.user._id || req.user.id;

    const wallet = await Wallet.findOne({ user: targetMerchantId }).lean();
    const orders = MaterialOrder
      ? await MaterialOrder.find({ merchantId: targetMerchantId }).sort({ createdAt: -1 }).limit(50).lean()
      : [];

    return res.status(200).json({
      success: true,
      balance: wallet?.balance || 0,
      settlementLedger: wallet?.merchantSettlementLedger || [],
      recentOrders: orders,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
