const express = require('express');
const router = express.Router();
const Material = require('../models/Material');
const { requireRole } = require('../middleware/authMiddleware');

// @route   POST /api/v1/materials
// @desc    Create a New Paint/Wall Material
// @access  Protected (Merchant / SuperAdmin)
router.post('/', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const { name, brand, unit, price, stock, description } = req.body;

    if (!name || price === undefined || Number(price) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid material name and non-negative price are required.',
      });
    }

    const material = await Material.create({
      name: String(name).trim(),
      brand: brand ? String(brand).trim() : 'Standard',
      unit: unit || 'Liter',
      price: Number(price),
      stock: Math.max(0, Number(stock) || 0),
      description: description ? String(description).trim() : '',
      merchant: req.user.id,
      status: req.user.role === 'SuperAdmin' ? 'Approved' : 'Pending',
    });

    res.status(201).json({
      success: true,
      material,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/materials
// @desc    Get Approved Material List
// @access  Public / Protected
router.get('/', async (req, res, next) => {
  try {
    const isSuperAdmin = req.user && req.user.role === 'SuperAdmin';
    const filter = isSuperAdmin ? {} : { status: 'Approved' };
    const materials = await Material.find(filter).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      count: materials.length,
      materials,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/materials/:id
// @desc    Get Single Material Details
// @access  Public / Protected
router.get('/:id', async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id).lean();
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }
    res.status(200).json({ success: true, material });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/v1/materials/:id
// @desc    Edit Material Price or Stock (Strictly blocks status manipulation)
// @access  Protected (Merchant Owner / SuperAdmin)
router.put('/:id', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    // Ownership check: Merchant can only edit their own materials
    if (req.user.role === 'Merchant' && String(material.merchant) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own materials.',
      });
    }

    // Whitelist only safe fields (Prevents Merchant from self-approving)
    const { name, brand, unit, price, stock, description } = req.body;
    if (name !== undefined) material.name = String(name).trim();
    if (brand !== undefined) material.brand = String(brand).trim();
    if (unit !== undefined) material.unit = unit;
    if (price !== undefined && Number(price) >= 0) material.price = Number(price);
    if (stock !== undefined && Number(stock) >= 0) material.stock = Number(stock);
    if (description !== undefined) material.description = String(description).trim();

    await material.save();

    res.status(200).json({ success: true, material });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/v1/materials/:id
// @desc    Delete a Material
// @access  Protected (Merchant Owner / SuperAdmin)
router.delete('/:id', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    if (req.user.role === 'Merchant' && String(material.merchant) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own materials.',
      });
    }

    await material.deleteOne();
    res.status(200).json({ success: true, message: 'Material deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/v1/materials/:id/approve
// @desc    Approve or Reject Merchant Material
// @access  Protected (SuperAdmin Only)
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

    res.status(200).json({
      success: true,
      message: `Material ${status.toLowerCase()} successfully.`,
      material,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
