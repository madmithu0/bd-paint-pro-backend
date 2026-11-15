const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Wallet = require('../models/Wallet');
const { requireRole } = require('../middleware/authMiddleware');

// @route   GET /api/v1/wallet
// @desc    Show Logged-in User Wallet Balance & Recent Transactions
// @access  Protected
router.get('/', async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user.id }).lean();
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user.id, balance: 0, transactions: [] });
    }

    res.status(200).json({
      success: true,
      balance: wallet.balance,
      transactions: (wallet.transactions || []).slice(-50).reverse(),
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/wallet/withdraw
// @desc    Request Withdrawal to Bkash / Nagad / Bank (Atomic Balance Check)
// @access  Protected (Mistri / Agent / Merchant)
router.post('/withdraw', requireRole(['Mistri', 'Agent', 'Merchant']), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, method, accountNumber } = req.body;
    const withdrawAmount = Number(amount);

    if (!withdrawAmount || withdrawAmount < 100 || !method || !accountNumber) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal is 100 BDT with valid payment method and account number.',
      });
    }

    const wallet = await Wallet.findOne({ user: req.user.id }).session(session);
    if (!wallet || wallet.balance < withdrawAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance.',
      });
    }

    wallet.balance = Number((wallet.balance - withdrawAmount).toFixed(2));
    wallet.transactions.push({
      type: 'WITHDRAW',
      amount: withdrawAmount,
      method,
      accountNumber,
      status: 'Pending',
      createdAt: new Date(),
    });

    await wallet.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully.',
      newBalance: wallet.balance,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// @route   GET /api/v1/wallet/withdraw-history
// @desc    Get User Withdrawal History
// @access  Protected
router.get('/withdraw-history', async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user.id }).lean();
    const withdrawals = (wallet?.transactions || [])
      .filter((t) => t.type === 'WITHDRAW')
      .reverse();

    res.status(200).json({
      success: true,
      count: withdrawals.length,
      withdrawals,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/wallet/equal-split-credit
// @desc    Credit Mistri 80% Share Equally Among Assigned Team Members
// @access  Protected (SuperAdmin / System Payout)
router.post('/equal-split-credit', requireRole(['SuperAdmin']), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { mistriIds, totalMistriPoolAmount, jobId } = req.body;

    if (!Array.isArray(mistriIds) || mistriIds.length === 0 || Number(totalMistriPoolAmount) <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Valid Mistri IDs array and positive pool amount are required.',
      });
    }

    const perMistriShare = Number((Number(totalMistriPoolAmount) / mistriIds.length).toFixed(2));

    for (const mistriId of mistriIds) {
      await Wallet.findOneAndUpdate(
        { user: mistriId },
        {
          $inc: { balance: perMistriShare },
          $push: {
            transactions: {
              type: 'EQUAL_SPLIT_CREDIT',
              amount: perMistriShare,
              jobId,
              status: 'Completed',
              createdAt: new Date(),
            },
          },
        },
        { upsert: true, new: true, session }
      );
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Credited BDT ${perMistriShare} equally to ${mistriIds.length} Mistris.`,
      perMistriShare,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

module.exports = router;
