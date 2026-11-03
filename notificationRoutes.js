const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// ১. রেট লিমিট কনফিগারেশন (Rate Limit: 100/min)
const apiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // ১ মিনিট
    max: 100, // প্রতি আইপি থেকে সর্বোচ্চ ১০০টি রিকোয়েস্ট
    message: {
        error: 'Too many requests from this IP, please try again after a minute.'
    },
    standardHeaders: true, // `RateLimit-*` হেডার রিটার্ন করবে
    legacyHeaders: false, // `X-RateLimit-*` হেডার নিষ্ক্রিয় করবে
});

// ২. নো-ফ্লাড প্রোটেকশন মিডলওয়্যার (noFlood / Anti-Spam)
// একই ইউজার যাতে পরপর খুব দ্রুত রিকোয়েস্ট পাঠিয়ে সার্ভার ডাউন করতে না পারে
const floodTimestamps = new Map();
const noFloodProtection = (req, res, next) => {
    const userId = req.user ? req.user.id : req.ip; // ইউজার আইডি বা আইপি এড্রেস
    const now = Date.now();
    const lastRequestTime = floodTimestamps.get(userId);

    if (lastRequestTime && (now - lastRequestTime) < 500) { // ৫০০ মিলিগ্রামের কম সময়ে দ্বিতীয় রিকোয়েস্ট ব্লক হবে
        return res.status(429).json({
            error: 'Flood detected. Please wait a moment before sending another request.'
        });
    }

    floodTimestamps.set(userId, now);
    next();
};

// গ্লোবালি মিডলওয়্যারগুলো যুক্ত করা হচ্ছে (সুরক্ষার জন্য)
router.use(apiRateLimiter);
router.use(noFloodProtection);

// ৩. নোটিফিকেশন রুট (notification)
router.post('/send', async (req, res) => {
    try {
        const { title, message, userId } = req.body;
        
        if (!title || !message || !userId) {
            return res.status(400).json({ error: 'Missing required fields: title, message, or userId' });
        }

        // এখানে আপনার নোটিফিকেশন ডাটাবেজে সেভ বা পুশ নোটিফিকেশন (FCM) পাঠানোর লজিক হবে
        // উদাহরণ: await Notification.create({ title, message, userId });

        return res.status(200).json({ success: true, message: 'Notification sent successfully.' });
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// ৪. ৫ বছরের চ্যাট ব্যাকআপ রুট (chat 5year)
router.get('/chat-history/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // ৫ বছর আগের তারিখ হিসাব করা হচ্ছে গ্যাপ/বাগ এড়াতে
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

        // ডাটাবেজ কোয়েরি (৫ বছর পর্যন্ত চ্যাট হিস্ট্রি ফিল্টার)
        // উদাহরণ: const chats = await Chat.find({ roomId, createdAt: { $gte: fiveYearsAgo } });

        return res.status(200).json({ 
            success: true, 
            message: 'Chat history retrieved (Up to 5 years).',
            data: [] // এখানে কুয়েরি করা চ্যাট ডেটা বসবে
        });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch chat history.', details: error.message });
    }
});

// ৫. লাইভ ট্র্যাকিং রুট (liveTracking)
router.post('/live-location', async (req, res) => {
    try {
        const { latitude, longitude, driverOrUserId } = req.body;

        if (!latitude || !longitude || !driverOrUserId) {
            return res.status(400).json({ error: 'Latitude, longitude, and user ID are required.' });
        }

        // রিয়েল-টাইম লোকেশন আপডেট করার লজিক (যেমন: Redis বা Socket.io তে ব্রডকাস্ট করা)
        // উদাহরণ: req.io.to(driverOrUserId).emit('locationUpdate', { latitude, longitude });

        return res.status(200).json({ success: true, message: 'Live location updated successfully.' });
    } catch (error) {
        return res.status(500).json({ error: 'Location tracking error.', details: error.message });
    }
});

module.exports = router;
