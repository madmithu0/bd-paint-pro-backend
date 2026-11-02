const Customer = require('../models/Customer');
const User = require('../models/User');
const Job = require('../models/Job');

// @desc Get all customers
// @route GET /api/customers
const getCustomers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const customers = await Customer.find(query)
      .populate('userId', 'name email role')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: customers,
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

// @desc Get single customer
// @route GET /api/customers/:id
const getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('userId');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer stats
    const totalJobs = await Job.countDocuments({ customerId: customer._id });
    const completedJobs = await Job.countDocuments({ 
      customerId: customer._id, 
      status: 'completed' 
    });

    res.json({
      success: true,
      data: {
        ...customer.toObject(),
        stats: { totalJobs, completedJobs }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update customer
// @route PUT /api/customers/:id
const updateCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, address, alternatePhone } = req.body;

    let customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, address, alternatePhone },
      { new: true, runValidators: true }
    );

    // Also update User collection
    if (customer.userId) {
      await User.findByIdAndUpdate(customer.userId, { name, email, phone });
    }

    res.json({
      success: true,
      message: 'Customer updated',
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete customer
// @route DELETE /api/customers/:id
const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    customer.isActive = false;
    await customer.save();

    if (customer.userId) {
      await User.findByIdAndUpdate(customer.userId, { isActive: false });
    }

    res.json({
      success: true,
      message: 'Customer deactivated'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get customer jobs
// @route GET /api/customers/:id/jobs
const getCustomerJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ customerId: req.params.id })
      .populate('serviceId', 'name price')
      .populate('mistriId', 'name phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerJobs
};