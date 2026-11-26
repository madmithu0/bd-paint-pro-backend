const crypto = require('crypto');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { verifyFirebasePhoneToken } = require('../utils/smsUtils');
const { sendUserGmailOtp } = require('../utils/emailUtils');

const getMyWallet = async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user.id }).lean();
    if (!wallet) {
      wallet = await Wallet.create({
        user: req.user.id,
        balance: 0,
        transactions: [],
        merchantSettlementLedger: [],
      });
    }

    const user = await User.findById(req.user.id).select('walletAccounts phone email role').lean();

    return res.status(200).json({
      success: true,
      wallet,
      walletAccounts: user?.walletAccounts || [],
    });
  } catch (error) {
    next(error);
  }
};

const requestWalletVerifyOtp = async (req, res, next) => {
  try {
    const { provider, accountNumber, channel = 'PHONE' } = req.body;
    const validProviders = ['bKash', 'Nagad', 'Rocket', 'Bank'];

    if (!validProviders.includes(provider) || !accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Valid provider (bKash, Nagad, Rocket, Bank) and account number are required.',
      });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (channel === 'EMAIL' && user.email) {
      const otpCode = String(crypto.randomInt(100000, 999999));
      await OTP.deleteMany({ userId: user._id, purpose: 'WALLET_VERIFY' });
      await OTP.create({
        userId: user._id,
        referenceId: `${provider}:${String(accountNumber).trim()}`,
        email: user.email,
        code: otpCode,
        provider: 'GMAIL_SMTP',
        purpose: 'WALLET_VERIFY',
      });

      await sendUserGmailOtp({
        email: user.email,
        otpCode,
        purpose: `Wallet Verification (${provider} - ${accountNumber})`,
      });

      return res.status(200).json({
        success: true,
        provider: 'GMAIL_SMTP',
        message: 'Wallet verification OTP sent to your registered Gmail.',
      });
    }

    await OTP.deleteMany({ userId: user._id, purpose: 'WALLET_VERIFY' });
    await OTP.create({
      userId: user._id,
      referenceId: `${provider}:${String(accountNumber).trim()}`,
      phone: user.phone,
      provider: 'FIREBASE_PHONE',
      purpose: 'WALLET_VERIFY',
    });

    return res.status(200).json({
      success: true,
      provider: 'FIREBASE_PHONE',
      useFirebase: true,
      formattedPhone: user.phone.startsWith('+88') ? user.phone : `+88${user.phone}`,
      message: 'Verify your registered phone via Firebase OTP to bind payout wallet.',
    });
  } catch (error) {
    next(error);
  }
};
const verifyAndSaveWalletAccount = async (req, res, next) => {
  try {
    const { provider, accountNumber, otpCode, firebaseIdToken } = req.body;
    const cleanAccount = String(accountNumber || '').trim();

    if (!provider || !cleanAccount) {
      return res.status(400).json({ success: false, message: 'Provider and account number are required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let isOtpValid = false;
    if (firebaseIdToken) {
      const fbResult = await verifyFirebasePhoneToken(firebaseIdToken);
      const userCleanPhone = user.phone.replace(/^\+88/, '');
      const fbCleanPhone = fbResult.phone.replace(/^\+88/, '');
      if (userCleanPhone === fbCleanPhone) {
        isOtpValid = true;
      }
    } else if (otpCode) {
      const otpDoc = await OTP.findOne({
        userId: user._id,
        purpose: 'WALLET_VERIFY',
        code: String(otpCode).trim(),
        verified: false,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      if (otpDoc) {
        otpDoc.verified = true;
        await otpDoc.save();
        isOtpValid = true;
      }
    }

    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Wallet account verification failed.',
      });
    }

    const existingIndex = user.walletAccounts.findIndex(
      (acc) => acc.provider === provider && acc.accountNumber === cleanAccount
    );

    if (existingIndex >= 0) {
      user.walletAccounts[existingIndex].isVerified = true;
      user.walletAccounts[existingIndex].verifiedAt = new Date();
    } else {
      user.walletAccounts.push({
        provider,
        accountNumber: cleanAccount,
        isVerified: true,
        verifiedAt: new Date(),
      });
    }
    await user.save();

    const wallet = await Wallet.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          verifiedWalletNumber: cleanAccount,
          walletProvider: provider,
          isWalletVerified: true,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `${provider} account (${cleanAccount}) verified and saved for payouts.`,
      walletAccounts: user.walletAccounts,
      wallet,
    });
  } catch (error) {
    next(error);
  }
};

const requestWithdraw = async (req, res, next) => {
  try {
    const { amount, provider, accountNumber } = req.body;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount < 100) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is BDT 100.' });
    }

    const user = await User.findById(req.user.id).lean();
    const verifiedAcc = user?.walletAccounts?.find(
      (acc) => acc.isVerified && (!provider || acc.provider === provider) && (!accountNumber || acc.accountNumber === String(accountNumber).trim())
    );

    if (!verifiedAcc) {
      return res.status(403).json({
        success: false,
        message: 'Payout blocked: You must verify a bKash/Nagad/Rocket/Bank account via OTP first.',
      });
    }

    const wallet = await Wallet.findOne({ user: req.user.id });
    if (!wallet || wallet.balance < numericAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
    }

    wallet.balance = Number((wallet.balance - numericAmount).toFixed(2));
    wallet.transactions.push({
      type: 'WITHDRAW',
      amount: numericAmount,
      method: verifiedAcc.provider,
      accountNumber: verifiedAcc.accountNumber,
      status: 'Pending',
      createdAt: new Date(),
    });
    await wallet.save();

    return res.status(200).json({
      success: true,
      message: `Withdrawal request of BDT ${numericAmount} submitted to verified ${verifiedAcc.provider} (${verifiedAcc.accountNumber}).`,
      balance: wallet.balance,
    });
  } catch (error) {
    next(error);
  }
};

const getMerchantSettlementLedger = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user.id }).select('merchantSettlementLedger balance').lean();
    return res.status(200).json({
      success: true,
      balance: wallet?.balance || 0,
      ledger: wallet?.merchantSettlementLedger || [],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyWallet,
  requestWalletVerifyOtp,
  verifyAndSaveWalletAccount,
  requestWithdraw,
  getMerchantSettlementLedger,
};
