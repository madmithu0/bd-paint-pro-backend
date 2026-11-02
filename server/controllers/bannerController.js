const Banner = require('../models/Banner');

// @desc Get all banners
// @route GET /api/banners
const getBanners = async (req, res, next) => {
  try {
    const { isActive, position } = req.query;

    let query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (position) {
      query.position = position;
    }

    const banners = await Banner.find(query)
      .sort({ sortOrder: 1, createdAt: -1 });

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get active banners for client
// @route GET /api/banners/active
const getActiveBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .sort({ sortOrder: 1 });

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single banner
// @route GET /api/banners/:id
const getBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.json({
      success: true,
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create banner
// @route POST /api/banners
const createBanner = async (req, res, next) => {
  try {
    const bannerData = req.body;

    if (req.file) {
      bannerData.image = `/uploads/banners/${req.file.filename}`;
    } else if (!bannerData.image) {
      return res.status(400).json({
        success: false,
        message: 'Banner image is required'
      });
    }

    const banner = await Banner.create(bannerData);

    res.status(201).json({
      success: true,
      message: 'Banner created',
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update banner
// @route PUT /api/banners/:id
const updateBanner = async (req, res, next) => {
  try {
    let banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    const updateData = req.body;

    if (req.file) {
      updateData.image = `/uploads/banners/${req.file.filename}`;
    }

    banner = await Banner.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Banner updated',
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete banner
// @route DELETE /api/banners/:id
const deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    await banner.deleteOne();

    res.json({
      success: true,
      message: 'Banner deleted'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBanners,
  getActiveBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner
};