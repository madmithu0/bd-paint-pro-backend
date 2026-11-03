/**
 * jwt.js
 * ফিচারসমূহ: 64-digit JWT Sign, Bcrypt 12 Rounds, Phone/Email OTP Encryption, এবং No JWT In URL Protection
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ১. ৬৪-ডিজিটের সিক্রেট কি এবং এনক্রিপশন কনফিগারেশন (64digit)
// প্রোডাকশনে এটি অবশ্যই আপনার .env ফাইল থেকে (process.env.JWT_SECRET) আসবে। 
// যদি .env-এ না থাকে, তবে সুরক্ষার জন্য স্বয়ংক্রিয়ভাবে একটি secure 64-character hex secret তৈরি হবে।
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'); 
const JWT_EXPIRES_IN = '1d'; // টোকেনের মেয়াদ ১ দিন

// ওটিপি এনক্রিপশনের জন্য কাস্টম অ্যালগরিদম ও ৩২ বাইটের চাবি
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const OTP_ENC_KEY = crypto.randomBytes(32); // প্রোডাকশনে এটিও .env-এ রাখবেন

module.exports = {
  
  // ২. পাসওয়ার্ড হ্যাশিং লজিক (bcrypt 12)
  // ১২ রাউন্ড সল্ট ব্যবহার করে পাসওয়ার্ড সিকিউরলি হ্যাশ করা
  hashPassword: async (password) => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  },

  // হ্যাশ করা পাসওয়ার্ড যাচাই করা
  comparePassword: async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
  },

  // ৩. জেডব্লিউটি টোকেন তৈরি ও সাইন (jwt sign + 64digit secret)
  generateToken: (userPayload) => {
    return jwt.sign(userPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      audience: 'your-app-users',
      issuer: 'your-backend-api'
    });
  },

  // টোকেন ভেরিফাই বা যাচাই করার ফাংশন
  verifyToken: (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  },

  // ৪. ওটিপি এনক্রিপশন লজিক (phoneOtp emailOtp encrypt)
  // ফোন ও ইমেইল ওটিপি ডাটাবেজে সেভ করার আগে এনক্রিপ্ট করার জন্য কাস্টম ফাংশন
  encryptOTP: (otpText) => {
    const iv = crypto.randomBytes(16); // ইনিশিয়ালাইজেশন ভেক্টর
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, OTP_ENC_KEY, iv);
    let encrypted = cipher.update(otpText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // iv এবং এনক্রিপ্টেড টেক্সট একসাথে কোলন (:) দিয়ে যুক্ত করে রিটার্ন করা হচ্ছে
    return `${iv.toString('hex')}:${encrypted}`;
  },

  // এনক্রিপ্ট করা ওটিপি ডিক্রিপ্ট (পুনরুদ্ধার) করা
  decryptOTP: (encryptedData) => {
    try {
      const [ivHex, encryptedText] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, OTP_ENC_KEY, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error("OTP Decryption failed");
    }
  },

  // ৫. এক্সপ্রেস মিডলওয়্যার: URL-এ টোকেন ব্লক করা (noJwtInURL)
  // যদি কোনো ইউজার বা হ্যাকার URL কুয়েরি প্যারামিটারে (যেমন: ?token=...) JWT পাঠানোর চেষ্টা করে, তা ব্লক করা হবে
  noJwtInURLMiddleware: (req, res, next) => {
    const tokenInQuery = req.query.token || req.query.jwt || req.query.access_token;
    
    // চেক করা হচ্ছে URL কুয়েরিতে কোনো টোকেন আছে কিনা বা টোকেন সদৃশ কিছু আছে কিনা
    if (tokenInQuery) {
      return res.status(400).json({
        status: "SECURE_AUTH_ERROR",
        message: "Security Violation: Passing JWT tokens via URL query parameters is strictly prohibited. Use HTTP Authorization headers instead."
      });
    }
    
    next();
  },

  // সাধারণ অথেন্টিকেশন মিডলওয়্যার (হেডার থেকে টোকেন চেক করার জন্য)
  authenticateUser: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Access denied. Token missing." });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded) {
      return res.status(403).json({ message: "Invalid or expired token." });
    }

    req.user = decoded;
    next();
  }
};
