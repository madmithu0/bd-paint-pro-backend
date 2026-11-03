const Redis = require('ioredis');

// রেডিস ক্লায়েন্ট ইনিশিয়ালাইজেশন
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

/**
 * ১. ওটিপি ভেরিফিকেশন এবং ৩ বার ভুল হলে লক করার লজিক (OTP 3 attempt lock)
 */
const verifyOTP = async (userId, inputOTP, actualOTP) => {
    const lockKey = `otp_lock:${userId}`;
    const attemptKey = `otp_attempts:${userId}`;

    // চেক করা হচ্ছে ইউজার অলরেডি লকড কিনা
    const isLocked = await redis.get(lockKey);
    if (isLocked) {
        return { success: false, message: "Account locked due to 3 failed attempts. Try again later." };
    }

    if (inputOTP === actualOTP) {
        await redis.del(attemptKey);
        return { success: true, message: "OTP verified successfully." };
    }

    // ভুল ওটিপি হলে কাউন্টার বাড়ানো
    const attempts = await redis.incr(attemptKey);
    if (attempts === 1) {
        await redis.expire(attemptKey, 600); // ১০ মিনিট ট্র্যাকিং টাইম
    }

    if (attempts >= 3) {
        await redis.set(lockKey, 'locked', 'EX', 1800); // ৩ বার ভুল হলে ৩০ মিনিট লক
        await redis.del(attemptKey);
        return { success: false, message: "Too many failed attempts. OTP login locked for 30 minutes." };
    }

    return { success: false, message: `Invalid OTP. ${3 - attempts} attempts remaining.` };
};

/**
 * ২. ব্রুট-ফোর্স প্রোটেকশন (bruteForce 15min block)
 * কোনো নির্দিষ্ট আইপি বা ইউজার আইডি থেকে ১৫ মিনিটে অতিরিক্ত রিকোয়েস্ট আসলে ব্লক করা
 */
const checkBruteForce = async (identifier, limit = 5) => {
    const rateKey = `brute:${identifier}`;
    const blockKey = `block:${identifier}`;

    const isBlocked = await redis.get(blockKey);
    if (isBlocked) {
        return { allowed: false, message: "Too many login attempts. Access blocked for 15 minutes." };
    }

    const currentAttempts = await redis.incr(rateKey);
    if (currentAttempts === 1) {
        await redis.expire(rateKey, 900); // ১৫ মিনিট ট্র্যাকিং উইন্ডো (900 সেকেন্ড)
    }

    if (currentAttempts > limit) {
        await redis.set(blockKey, 'blocked', 'EX', 900); // ১৫ মিনিটের জন্য ব্লক (900 সেকেন্ড)
        await redis.del(rateKey);
        return { allowed: false, message: "Brute-force detected. Access blocked for 15 minutes." };
    }

    return { allowed: true, attemptsRemaining: limit - currentAttempts };
};

module.exports = {
    redis,
    verifyOTP,
    checkBruteForce
};
