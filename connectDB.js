const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI;
const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [];
const connectDB = async () => {
    try {
        const urlParser = new URL(MONGO_URI);
        const password = decodeURIComponent(urlParser.password);
        if (!password || password.length !== 32) {
            throw new Error("Security Alert: MongoDB password must be exactly 32 characters long.");
        }
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        };
        await mongoose.connect(MONGO_URI, options);
        const adminDb = mongoose.connection.db.admin();
        const buildInfo = await adminDb.command({ buildInfo: 1 });
        if (process.env.NODE_ENV === 'production') {
            const host = urlParser.hostname;
            if (!host.includes('.bd') && !host.includes('localhost') && host !== '127.0.0.1') {
                throw new Error("Data Residency Violation: Database cluster must be locked to BD region.");
            }
        }
    } catch (error) {
        process.exit(1);
    }
};
const verifyIPAccess = (req, res, next) => {
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }
    if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.replace('::ffff:', '');
    }
    if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(clientIp) && clientIp !== '127.0.0.1' && clientIp !== '::1') {
        return res.status(403).json({ error: "Access Denied: IP not whitelisted." });
    }
    next();
};
module.exports = { connectDB, verifyIPAccess };
