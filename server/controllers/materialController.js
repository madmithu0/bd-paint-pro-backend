const Material = require('../models/Material');

// @desc Get all materials
// @route GET /api/materials
const getMaterials = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category, isActive, lowStock } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) query.category = category;
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (lowStock === 'true') {
      query.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
    }

    const materials = await Material.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Material.countDocuments(query);

    res.json({
      success: true,
      data: materials,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single material
// @route GET /api/materials/:id
const getMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    res.json({
      success: true,
      data: material
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create material
// @route POST /api/materials
const createMaterial = async (req, res, next) => {
  try {
    const materialData = req.body;

    if (req.file) {
      materialData.image = `/uploads/materials/${req.file.filename}`;
    }

    // Generate SKU if not provided
    if (!materialData.sku) {
      materialData.sku = `MAT-${Date.now()}`;
    }

    const material = await Material.create(materialData);

    res.status(201).json({
      success: true,
      message: 'Material created',
      data: material
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update material
// @route PUT /api/materials/:id
const updateMaterial = async (req, res, next) => {
  try {
    let material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    const updateData = req.body;

    if (req.file) {
      updateData.image = `/uploads/materials/${req.file.filename}`;
    }

    material = await Material.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Material updated',
      data: material
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete material
// @route DELETE /api/materials/:id
const deleteMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    material.isActive = false;
    await material.save();

    res.json({
      success: true,
      message: 'Material deactivated'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update stock
// @route PUT /api/materials/:id/stock
const updateStock = async (req, res, next) => {
  try {
    const { quantity, type } = req.body; // type: add, subtract, set

    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    if (type === 'add') {
      material.quantity += parseInt(quantity);
    } else if (type === 'subtract') {
      material.quantity -= parseInt(quantity);
      if (material.quantity < 0) material.quantity = 0;
    } else if (type === 'set') {
      material.quantity = parseInt(quantity);
    }

    await material.save();

    res.json({
      success: true,
      message: 'Stock updated',
      data: material
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get low stock materials
// @route GET /api/materials/low-stock/list
const getLowStock = async (req, res, next) => {
  try {
    const materials = await Material.find({
      isActive: true,
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
    }).sort({ quantity: 1 });

    res.json({
      success: true,
      data: materials
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  updateStock,
  getLowStock
};