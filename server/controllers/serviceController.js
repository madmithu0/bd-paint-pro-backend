const Service = require('../models/Service');

// @desc Get all services
// @route GET /api/services
const getServices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category, isActive } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    } else {
      query.isActive = true;
    }

    const services = await Service.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ sortOrder: 1, createdAt: -1 });

    const total = await Service.countDocuments(query);

    res.json({
      success: true,
      data: services,
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

// @desc Get single service
// @route GET /api/services/:id
const getService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create service
// @route POST /api/services
const createService = async (req, res, next) => {
  try {
    const serviceData = req.body;

    if (req.file) {
      serviceData.image = `/uploads/services/${req.file.filename}`;
    }

    const service = await Service.create(serviceData);

    res.status(201).json({
      success: true,
      message: 'Service created',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update service
// @route PUT /api/services/:id
const updateService = async (req, res, next) => {
  try {
    let service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    const updateData = req.body;

    if (req.file) {
      updateData.image = `/uploads/services/${req.file.filename}`;
    }

    service = await Service.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Service updated',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete service
// @route DELETE /api/services/:id
const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    service.isActive = false;
    await service.save();

    res.json({
      success: true,
      message: 'Service deactivated'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get categories
// @route GET /api/services/categories/list
const getCategories = async (req, res, next) => {
  try {
    const categories = await Service.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  getCategories
};