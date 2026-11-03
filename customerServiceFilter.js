/**
 * customerServiceFilter.js
 * ফিচারসমূহ: Customer Filter, Service Bill Matcher, 
 * Conditional Profit Split (80/5/15 or 80/20), এবং Anti-Price Tamper।
 */

module.exports = {

  // ১. কাস্টমার এবং সার্ভিস ডেটা ফিল্টার (customerFilter)
  // রিকোয়েস্ট থেকে আসা ডেটা ক্লেনজিং এবং ভ্যালিডেশন করা
  filterCustomerRequest: (reqData) => {
    const { customerId, serviceId, requestedPrice } = reqData;

    if (!customerId || !serviceId || !requestedPrice) {
      throw new Error("Missing required fields: customerId, serviceId, or requestedPrice");
    }

    // ডেটা ট্রিম এবং ক্লিন করে রিটার্ন করা
    return {
      customerId: String(customerId).trim(),
      serviceId: String(serviceId).trim(),
      requestedPrice: parseFloat(requestedPrice)
    };
  },

  // ২. অ্যান্টি-প্রাইস ট্যাম্পারিং এবং বিল ম্যাচিং লজিক (serviceBillMatcher + noPriceTamper)
  // ফ্রন্টএন্ড বা ক্লায়েন্ট থেকে পাঠানো প্রাইস ডাটাবেজের অরিজিনাল প্রাইসের সাথে ম্যাচ করছে কিনা তা যাচাই করা
  matchAndVerifyBill: (requestedPrice, dbServiceData) => {
    if (!dbServiceData || typeof dbServiceData.basePrice !== 'number') {
      throw new Error("Invalid database service records.");
    }

    // noPriceTamper: ক্লায়েন্ট থেকে পাঠানো মূল্য ডাটাবেজের মূল্যের চেয়ে কম বা ভিন্ন হলে ব্লক করা
    if (requestedPrice !== dbServiceData.basePrice) {
      throw new Error("Security Alert: Price tampering detected! Requested price does not match system records.");
    }

    return true; // বিল এবং প্রাইস সম্পূর্ণ নির্ভুল
  },

  // ৩. কন্ডিশনাল লভ্যাংশ বন্টন লজিক (profitSplit conditional if agent 80/5/15 else 80/20)
  // এজেন্টের উপস্থিতির উপর ভিত্তি করে লাভের টাকা ভাগ করার মেকানিজম
  calculateProfitSplit: (totalBill, hasAgent = false) => {
    if (typeof totalBill !== 'number' || totalBill <= 0) {
      throw new Error("Invalid bill amount for profit splitting.");
    }

    let splitResult = {};

    if (hasAgent) {
      // কন্ডিশন ১: যদি এজেন্ট থাকে (80/5/15 স্প্লিট)
      // উদাহরণস্বরূপ: ৮০% কোম্পানি, ৫% এজেন্ট, ১৫% সার্ভিস প্রোভাইডার/ভ্যাট/অন্যান্য খাত
      splitResult = {
        strategy: "80/5/15 (Agent Included)",
        companyShare: parseFloat((totalBill * 0.80).toFixed(2)),
        agentShare: parseFloat((totalBill * 0.05).toFixed(2)),
        partnerShare: parseFloat((totalBill * 0.15).toFixed(2))
      };
    } else {
      // কন্ডিশন ২: যদি এজেন্ট না থাকে (80/20 স্প্লিট)
      // উদাহরণস্বরূপ: ৮০% কোম্পানি, ২০% সার্ভিস প্রোভাইডার/পার্টনার
      splitResult = {
        strategy: "80/20 (No Agent)",
        companyShare: parseFloat((totalBill * 0.80).toFixed(2)),
        partnerShare: parseFloat((totalBill * 0.20).toFixed(2)),
        agentShare: 0.00
      };
    }

    return splitResult;
  },

  // ৪. এক্সপ্রেস মিডলওয়্যার: ট্রানজেকশন প্রসেস করার জন্য
  // এই মিডলওয়্যারটি রাউটে কল করে সমস্ত ফিল্টার, ম্যাচিং এবং স্প্লিট একসাথে হ্যান্ডেল করা যাবে
  processServiceTransactionMiddleware: async (req, res, next) => {
    try {
      // ক) ইনপুট ফিল্টার করা (customerFilter)
      const cleanData = module.exports.filterCustomerRequest(req.body);

      // এখানে আপনার ডাটাবেজ থেকে সার্ভিসের অরিজিনাল ডাটা নিয়ে আসার ডামি কোড (যেমন: MongoDB/PostgreSQL)
      // উদাহরণস্বরূপ ধরে নিচ্ছি ডাটাবেজে এই সার্ভিসের প্রাইস ৫০০ টাকা:
      const mockDbServiceData = { serviceId: cleanData.serviceId, basePrice: 500 }; 

      // খ) প্রাইস ট্যাম্পারিং চেক ও বিল ম্যাচিং (serviceBillMatcher + noPriceTamper)
      module.exports.matchAndVerifyBill(cleanData.requestedPrice, mockDbServiceData);

      // গ) লভ্যাংশ বন্টন হিসাব (profitSplit)
      // ক্লায়েন্ট রিকোয়েস্টে এজেন্ট আইডি বা ফ্ল্যাগ থাকলে তা চেক করা হচ্ছে
      const hasAgent = !!req.body.agentId; 
      const finalSplit = module.exports.calculateProfitSplit(cleanData.requestedPrice, hasAgent);

      // রেজাল্ট পরবর্তী ব্যবহারের জন্য রিকোয়েস্ট অবজেক্টে সেভ করা
      req.transactionDetails = {
        ...cleanData,
        split: finalSplit
      };

      next();
    } catch (error) {
      // সিকিউরিটি ভায়োলেশন বা ভুল ডাটার জন্য এরর রেসপন্স
      return res.status(400).json({
        status: "TRANSACTION_FILTER_ERROR",
        message: error.message
      });
    }
  }
};
