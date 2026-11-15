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

    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Material name and price are required.',
      });
    }

    const material = await Material.create({
      name,
      brand: brand || 'Standard',
      unit: unit || 'Liter',
      price: Number(price),
      stock: Number(stock) || 0,
      description: description || '',
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
// @desc    Get Material List
// @access  Protected
router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.role === 'SuperAdmin' ? {} : { status: 'Approved' };
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
// @desc    Get Material Details
// @access  Protected
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
// @desc    Edit Material Price or Stock
// @access  Protected (Merchant / SuperAdmin)
router.put('/:id', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const material = await Material.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }
    res.status(200).json({ success: true, material });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/v1/materials/:id
// @desc    Delete a Material
// @access  Protected (Merchant / SuperAdmin)
router.delete('/:id', requireRole(['Merchant', 'SuperAdmin']), async (req, res, next) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }
    res.status(200).json({ success: true, message: 'Material deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/v1/materials/:id/approve
// @desc    Approve or Reject Merchant Material
// @access  Protected (SuperAdmin)
router.patch('/:id/approve', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { status } = req.body; // 'Approved' or 'Rejected'
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
