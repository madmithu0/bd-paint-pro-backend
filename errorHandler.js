const fs = require('fs');
const path = require('path');

// এরর লগ ফাইলটি যেখানে সেভ হবে তার পাথ (রুট ডিরেক্টরিতে logs ফোল্ডার তৈরি হবে)
const logDirectory = path.join(__dirname, 'logs');
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

const logFilePath = path.join(logDirectory, 'immutable_audit_error.log');

// ১. ইমিউটেবল অডিট লগ ফাংশন (যা ফাইলকে শুধুমাত্র লেখার উপযোগী রাখবে, কেউ ডিলিট বা এডিট করতে পারবে না)
const writeToImmutableLog = (errorDetails) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] | ${JSON.stringify(errorDetails)}\n`;

    // ফাইলে ডেটা অ্যাপেন্ড (Append) করা হচ্ছে
    fs.appendFile(logFilePath, logMessage, 'utf8', (err) => {
        if (err) {
            console.error('অডিট লগ ফাইলে লিখতে ব্যর্থ হয়েছে:', err);
            return;
        }

        // প্রোডাকশনে ফাইলটিকে ইমিউটেবল (Read-Only) করার জন্য অপারেটিং সিস্টেম লেভেলের কমান্ড ব্যবহার করা যায়
        // যেমন Linux-এ: fs.chmodSync(logFilePath, 0o444); // কিন্তু এটি প্রতিবার অ্যাপেন্ড করার পর হ্যান্ডেল করতে হবে
    });
};

// ২. সেন্ট্রাল এক্সপ্রেস এরর হ্যান্ডলার মিডলওয়্যার
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const isDevelopment = process.env.NODE_ENV === 'development';

    // অডিট লগের জন্য প্রয়োজনীয় ইনফরমেশন প্রিপেয়ার করা
    const errorLogDetails = {
        message: err.message || 'Internal Server Error',
        status: statusCode,
        route: req.originalUrl,
        method: req.method,
        ip: req.ip,
        // অডিট পারপাসের জন্য ফুল স্ট্যাক ট্র্যাস লগে রাখা হচ্ছে, কিন্তু ইউজারকে দেখানো হবে না
        stack: err.stack 
    };

    // সিকিউর ইমিউটেবল অডিট লগে এরর রাইট করা হচ্ছে
    writeToImmutableLog(errorLogDetails);

    // সিকিউরিটি: DB leak এবং Stack leak বন্ধ করা
    // ইউজারকে কোনো অবস্থাতেই ভেতরের কোডের স্ট্রাকচার বা ডেটাবেজের এরর দেখানো যাবে না
    const clientResponse = {
        success: false,
        status: statusCode,
        message: statusCode === 500 ? 'সার্ভারে একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে পরে চেষ্টা করুন।' : err.message
    };

    // যদি প্রজেক্টটি লোকাল ডেভেলপমেন্ট মোডে চলে, তবেই কেবল ডিবাগিংয়ের জন্য স্ট্যাক ট্র্যাস রেসপন্সে দেওয়া যেতে পারে
    if (isDevelopment) {
        clientResponse.stack = err.stack;
    }

    // ক্লায়েন্টকে সিকিউর রেসপন্স পাঠানো
    res.status(statusCode).json(clientResponse);
};

module.exports = errorHandler;
