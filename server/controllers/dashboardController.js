const User = require('../models/User');
const Customer = require('../models/Customer');
const Mistri = require('../models/Mistri');
const Job = require('../models/Job');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');

// @desc Get dashboard overview stats
// @route GET /api/dashboard/overview
const getOverview = async (req, res, next) => {
  try {
    const totalCustomers = await Customer.countDocuments({ isActive: true });
    const totalMistris = await Mistri.countDocuments({ isActive: true });
    const totalServices = await Service.countDocuments({ isActive: true });
    const totalJobs = await Job.countDocuments();

    const pendingJobs = await Job.countDocuments({ status: 'pending' });
    const inProgressJobs = await Job.countDocuments({ status: 'in_progress' });
    const completedJobs = await Job.countDocuments({ status: 'completed' });
    const assignedJobs = await Job.countDocuments({ status: 'assigned' });

    const availableMistris = await Mistri.countDocuments({ isAvailable: true, isActive: true });

    // Financial summary
    const incomeResult = await Transaction.aggregate([
      { $match: { type: 'income', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const expenseResult = await Transaction.aggregate([
      { $match: { type: 'expense', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalIncome = incomeResult[0]?.total || 0;
    const totalExpense = expenseResult[0]?.total || 0;

    // This month stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthJobs = await Job.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    const thisMonthIncome = await Transaction.aggregate([
      { $match: { type: 'income', status: 'completed', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      data: {
        counts: {
          customers: totalCustomers,
          mistris: totalMistris,
          services: totalServices,
          jobs: totalJobs,
          availableMistris
        },
        jobs: {
          pending: pendingJobs,
          assigned: assignedJobs,
          inProgress: inProgressJobs,
          completed: completedJobs,
          total: totalJobs
        },
        financial: {
          totalIncome,
          totalExpense,
          profit: totalIncome - totalExpense,
          thisMonthIncome: thisMonthIncome[0]?.total || 0
        },
        thisMonth: {
          jobs: thisMonthJobs
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get recent jobs
// @route GET /api/dashboard/recent-jobs
const getRecentJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find()
      .populate('customerId', 'name phone')
      .populate('mistriId', 'name phone')
      .populate('serviceId', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get revenue chart data
// @route GET /api/dashboard/revenue-chart
const getRevenueChart = async (req, res, next) => {
  try {
    const { period = '7days' } = req.query;

    let groupFormat = '%Y-%m-%d';
    let startDate = new Date();

    if (period === '7days') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === '30days') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === '12months') {
      startDate.setMonth(startDate.getMonth() - 12);
      groupFormat = '%Y-%m';
    }

    const revenueData = await Transaction.aggregate([
      {
        $match: {
          type: 'income',
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const expenseData = await Transaction.aggregate([
      {
        $match: {
          type: 'expense',
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        revenue: revenueData,
        expense: expenseData
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get top services
// @route GET /api/dashboard/top-services
const getTopServices = async (req, res, next) => {
  try {
    const topServices = await Job.aggregate([
      {
        $group: {
          _id: '$serviceId',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'service'
        }
      },
      { $unwind: '$service' }
    ]);

    res.json({
      success: true,
      data: topServices
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get top mistris
// @route GET /api/dashboard/top-mistris
const getTopMistris = async (req, res, next) => {
  try {
    const topMistris = await Job.aggregate([
      { $match: { status: 'completed', mistriId: { $ne: null } } },
      {
        $group: {
          _id: '$mistriId',
          completedJobs: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { completedJobs: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'mistris',
          localField: '_id',
          foreignField: '_id',
          as: 'mistri'
        }
      },
      { $unwind: '$mistri' }
    ]);

    res.json({
      success: true,
      data: topMistris
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getRecentJobs,
  getRevenueChart,
  getTopServices,
  getTopMistris
};