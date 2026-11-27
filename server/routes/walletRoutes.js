const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const router = express.Router();
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const OTP = require('../models/OTP');
const AuditLog = require('../models/AuditLog');
const { requireRole } = require('../middleware/authMiddleware');

const safeRequire = (path) => {
  try {
    return require(path);
  } catch (err) {
    return null;
  }
};

const walletVerifyService = safeRequire('../services/walletVerifyService');
const smsUtils = safeRequire('../utils/smsUtils');

const ALLOWED_PROVIDERS = ['bKash', 'Nagad', 'Rocket', 'Bank'];

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    let wallet = await Wallet.findOne({ user: userId }).lean();
    if (!wallet) {
      wallet = await Wallet.create({ user: userId, balance: 0, transactions: [] });
    }

    const user = await User.findById(userId).select('walletAccounts phone').lean();

    return res.status(200).json({
      success: true,
      balance: wallet.balance,
      verifiedWalletNumber: wallet.verifiedWalletNumber || '',
      walletProvider: wallet.walletProvider || '',
      walletAccounts: user?.walletAccounts || [],
      merchantSettlementLedger: wallet.merchantSettlementLedger || [],
      transactions: (wallet.transactions || []).slice(-50).reverse(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/accounts/request-otp', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { provider, accountNumber } = req.body;

    if (!ALLOWED_PROVIDERS.includes(provider) || !accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Valid provider (bKash, Nagad, Rocket, Bank) and account number are required.',
      });
    }

    const cleanAccount = String(accountNumber).trim();

    if (walletVerifyService?.requestWalletOtp) {
      const result = await walletVerifyService.requestWalletOtp({
        userId,
        provider,
        accountNumber: cleanAccount,
      });
      return res.status(200).json({ success: true, ...result });
    }

    const user = await User.findById(userId).lean();
    const targetPhone = provider === 'Bank' ? user?.phone : cleanAccount;

    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Valid phone number required for OTP.' });
    }

    const otpCode = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTP.deleteMany({ phone: targetPhone, purpose: 'WALLET_VERIFY', verified: false });
    await OTP.create({
      phone: targetPhone,
      code: otpCode,
      purpose: 'WALLET_VERIFY',
      verified: false,
      expiresAt,
    });

    if (smsUtils?.sendSms) {
      await smsUtils.sendSms(
        targetPhone,
        `Your Wallet Verification OTP for ${provider} (${cleanAccount}) is: ${otpCode}`
      ).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'Wallet ownership verification OTP sent via SMS.',
      ...(process.env.DEV_MODE === 'true' && { devOtp: otpCode }),
    });
  } catch (error) {
    next(error);
  }
});
router.post('/accounts/verify-otp', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { provider, accountNumber, otpCode } = req.body;

    if (!ALLOWED_PROVIDERS.includes(provider) || !accountNumber || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Provider, account number, and OTP code are required.',
      });
    }

    const cleanAccount = String(accountNumber).trim();

    if (walletVerifyService?.verifyWalletOtp) {
      const result = await walletVerifyService.verifyWalletOtp({
        userId,
        provider,
        accountNumber: cleanAccount,
        otpCode: String(otpCode).trim(),
      });
      return res.status(200).json({ success: true, ...result });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetPhone = provider === 'Bank' ? user.phone : cleanAccount;
    const otpRecord = await OTP.findOne({
      phone: targetPhone,
      code: String(otpCode).trim(),
      purpose: 'WALLET_VERIFY',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired wallet OTP.' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    if (!Array.isArray(user.walletAccounts)) user.walletAccounts = [];
    const existingIdx = user.walletAccounts.findIndex(
      (w) => w.provider === provider && w.accountNumber === cleanAccount
    );

    const accountEntry = {
      provider,
      accountNumber: cleanAccount,
      isVerified: true,
      verifiedAt: new Date(),
    };

    if (existingIdx >= 0) {
      user.walletAccounts[existingIdx] = accountEntry;
    } else {
      user.walletAccounts.push(accountEntry);
    }
    await user.save();

    await Wallet.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          verifiedWalletNumber: cleanAccount,
          walletProvider: provider,
        },
      },
      { upsert: true }
    );

    await AuditLog.create({
      user: String(userId),
      role: user.role,
      action: 'WALLET_NUMBER_OTP_VERIFIED',
      category: 'FINANCE',
      ipAddress: req.ip || '',
      details: { provider, accountNumber: cleanAccount },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Payout wallet verified and saved successfully.',
      walletAccounts: user.walletAccounts,
    });
  } catch (error) {
    next(error);
  }
});
router.post('/withdraw', requireRole(['Mistri', 'Agent', 'Merchant']), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id || req.user.id;
    const { amount, method, accountNumber } = req.body;
    const withdrawAmount = Number(amount);

    if (!withdrawAmount || withdrawAmount < 100 || !method || !accountNumber) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal is 100 BDT with valid payment method and account number.',
      });
    }

    const cleanAccount = String(accountNumber).trim();
    const user = await User.findById(userId).session(session).lean();
    const isAccountVerified = (user?.walletAccounts || []).some(
      (w) => w.provider === method && w.accountNumber === cleanAccount && w.isVerified === true
    );

    if (!isAccountVerified) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Payout account must be verified via SMS OTP before withdrawal.',
      });
    }

    const wallet = await Wallet.findOne({ user: userId }).session(session);
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
      accountNumber: cleanAccount,
      status: 'Pending',
      createdAt: new Date(),
    });

    await wallet.save({ session });
    await session.commitTransaction();

    return res.status(200).json({
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

router.get('/withdraw-history', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const wallet = await Wallet.findOne({ user: userId }).lean();
    const withdrawals = (wallet?.transactions || [])
      .filter((t) => t.type === 'WITHDRAW')
      .reverse();

    return res.status(200).json({
      success: true,
      count: withdrawals.length,
      withdrawals,
    });
  } catch (error) {
    next(error);
  }
});
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

    return res.status(200).json({
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

router.post('/merchant-settlement', requireRole(['SuperAdmin']), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { merchantId, orderId, materialAmount, commissionAmount, dealerMargin = 0 } = req.body;
    const netSettlement = Number((Number(materialAmount) - Number(commissionAmount) + Number(dealerMargin)).toFixed(2));

    if (!merchantId || netSettlement <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Valid merchantId and positive settlement amount are required.',
      });
    }

    const wallet = await Wallet.findOneAndUpdate(
      { user: merchantId },
      {
        $inc: { balance: netSettlement },
        $push: {
          merchantSettlementLedger: {
            orderId,
            materialAmount: Number(materialAmount),
            commissionDeducted: Number(commissionAmount),
            dealerMargin: Number(dealerMargin),
            netCredited: netSettlement,
            settledAt: new Date(),
          },
          transactions: {
            type: 'MERCHANT_SETTLEMENT',
            amount: netSettlement,
            status: 'Completed',
            createdAt: new Date(),
          },
        },
      },
      { upsert: true, new: true, session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Merchant settlement credited successfully.',
      netSettlement,
      newBalance: wallet.balance,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

module.exports = router;
