const rateLimit = require('express-rate-limit');

// ১. সাধারণ রিকোয়েস্টের জন্য রেট লিমিটার (প্রতি মিনিটে ১০০টি)
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // ১ মিনিট
    max: 100, // প্রতি IP থেকে সর্বোচ্চ ১০০টি রিকোয়েস্ট
    message: {
        success: false,
        message: "অতিরিক্ত রিকোয়েস্ট করা হয়েছে। অনুগ্রহ করে ১ মিনিট পর আবার চেষ্টা করুন।"
    },
    standardHeaders: true, // `RateLimit-*` হেডার ফেরত পাঠাবে
    legacyHeaders: false, // `X-RateLimit-*` হেডার বন্ধ রাখবে
});

// ২. ওটিপি (OTP) ভেরিফিকেশনের জন্য রেট লিমিটার (১৫ মিনিটে সর্বোচ্চ ৩ বার)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // ১৫ মিনিট ব্লক টাইম
    max: 3, // সর্বোচ্চ ৩ বার চেষ্টার সুযোগ
    message: {
        success: false,
        message: "সর্বোচ্চ ৩ বার ওটিপি চেষ্টার সীমা অতিক্রম করেছেন। ১৫ মিনিটের জন্য আপনার আইপি ব্লক করা হয়েছে।"
    },
    standardHeaders: true,
    legacyHeaders: false,
    // অটো আইপি ব্ল্যাকলিস্টের জন্য প্রোডাকশন লেভেলে Redis বা কোনো DB ট্র্যাকিং ব্যবহার করা ভালো
    handler: (req, res, next, options) => {
        console.warn(`IP Blacklisted temporarily for OTP abuse: ${req.ip}`);
        res.status(options.statusCode).send(options.message);
    }
});

// ৩. লগইন (Login) চেষ্টার জন্য রেট লিমিটার (১৫ মিনিটে সর্বোচ্চ ৫ বার)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // ১৫ মিনিট ব্লক টাইম
    max: 5, // সর্বোচ্চ ৫ বার চেষ্টার সুযোগ
    message: {
        success: false,
        message: "লগইনের জন্য সর্বোচ্চ ৫ বার ভুল চেষ্টার সীমা অতিক্রম করেছেন। ১৫ মিনিটের জন্য ব্লক করা হয়েছে।"
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        console.warn(`IP Blacklisted temporarily for Login abuse: ${req.ip}`);
        res.status(options.statusCode).send(options.message);
    }
});

module.exports = {
    generalLimiter,
    otpLimiter,
    loginLimiter
};
