const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const ENCRYPTION_KEY = process.env.AES_KEY ? Buffer.from(process.env.AES_KEY, 'hex') : crypto.randomBytes(32); 
const IV_LENGTH = 16;

/**
 * ১. AES-256 ওটিপি এনক্রিপশন (otpEncrypt AES256)
 */
const encryptOTP = (otpText) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(otpText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * ২. ফোন এবং ইমেইল ফরম্যাট ভ্যালিডেশন (phoneEmailVerify)
 */
const validatePhoneAndEmail = (phone, email) => {
    const bdPhoneRegex = /^(?:\+8801|8801|01)[3-9]\d{8}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!bdPhoneRegex.test(phone)) {
        throw new Error("Validation Fault: Invalid Bangladeshi phone number.");
    }
    if (!emailRegex.test(email)) {
        throw new Error("Validation Fault: Invalid email format.");
    }
    return true;
};

/**
 * ৩. ক্রিপ্টোগ্রাফিক সিগনেচার ভেরিফিকেশন (signatureVerify)
 */
const verifySignature = (payload, signature, secret) => {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    return expectedSignature === signature;
};

/**
 * ৪. JWT ভেরিফিকেশন মিডলওয়্যার এবং লিক প্রোটেকশন (jwt verify + noJwtLeak)
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Access Denied: Token missing or invalid." });
    }

    const token = authHeader.split(' ')[1];

    try {
        if (!JWT_SECRET || JWT_SECRET.length !== 64) {
            throw new Error("Security Fault: Invalid server configurations.");
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // JWT Leak Prevention: ডাটাবেস আইডির মতো সংবেদনশীল ইনফো রেসপন্সে লিক হওয়া বন্ধ করতে রিকোয়েস্ট অবজেক্টে ফিল্টার করা হচ্ছে
        req.user = {
            id: decoded.id,
            role: decoded.role
        };

        // ব্রাউজার বা মেমোরিতে যেন টোকেন এক্সপোজড না থাকে তাই হেডার সিকিউর করা হচ্ছে
        res.setHeader('Clear-Site-Data', '"cache", "storage"');
        
        next();
    } catch (error) {
        return res.status(403).json({ error: "Access Denied: Compromised or expired token." });
    }
};

module.exports = {
    verifyToken,
    encryptOTP,
    validatePhoneAndEmail,
    verifySignature
};
