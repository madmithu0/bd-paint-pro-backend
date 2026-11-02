const Transaction = require('../models/Transaction');
const Job = require('../models/Job');

// @desc Get all transactions
// @route GET /api/transactions
const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, type, status, category, customerId, startDate, endDate } = req.query;

    let query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (category) query.category = category;
    if (customerId) query.customerId = customerId;

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.createdAt = { $gte: new Date(startDate) };
    }

    const transactions = await Transaction.find(query)
      .populate('jobId', 'jobNumber status')
      .populate('customerId', 'name phone')
      .populate('createdBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Transaction.countDocuments(query);

    // Calculate totals
    const incomeTotal = await Transaction.aggregate([
      { $match: { ...query, type: 'income', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const expenseTotal = await Transaction.aggregate([
      { $match: { ...query, type: 'expense', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      data: transactions,
      summary: {
        income: incomeTotal[0]?.total || 0,
        expense: expenseTotal[0]?.total || 0,
        profit: (incomeTotal[0]?.total || 0) - (expenseTotal[0]?.total || 0)
      },
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

// @desc Get single transaction
// @route GET /api/transactions/:id
const getTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('jobId')
      .populate('customerId')
      .populate('mistriId');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create transaction
// @route POST /api/transactions
const createTransaction = async (req, res, next) => {
  try {
    const { jobId, customerId, mistriId, type, category, amount, description, paymentMethod } = req.body;

    const transaction = await Transaction.create({
      jobId,
      customerId,
      mistriId,
      type,
      category,
      amount,
      description,
      paymentMethod: paymentMethod || 'cash',
      status: 'completed',
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Transaction created',
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update transaction
// @route PUT /api/transactions/:id
const updateTransaction = async (req, res, next) => {
  try {
    let transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Transaction updated',
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete transaction
// @route DELETE /api/transactions/:id
const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    await transaction.deleteOne();

    res.json({
      success: true,
      message: 'Transaction deleted'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get financial summary
// @route GET /api/transactions/summary/financial
const getFinancialSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let matchQuery = { status: 'completed' };

    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const summary = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryWise = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary,
        categoryWise
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getFinancialSummary
};