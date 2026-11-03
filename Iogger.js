const winston = require('winston');
const path = require('path');

// সেনসিটিভ ডেটা ফিল্টার করার জন্য কাস্টম ফরম্যাট (noSensitiveLog)
const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'otp'];
const maskSensitiveData = winston.format((info) => {
  if (info.meta && typeof info.meta === 'object') {
    sensitiveFields.forEach(field => {
      if (field in info.meta) {
        info.meta[field] = '********'; // সেনসিটিভ তথ্য মাস্ক করা হচ্ছে
      }
    });
  }
  return info;
});

// উইনস্টন লগ ফরম্যাট কনফিগারেশন
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.metadata({ fillWith: ['timestamp', 'ip', 'isHackAttempt'] }),
  maskSensitiveData(),
  winston.format.json() // ইমিউটেবল ও ক্লাউড-ফ্রেন্ডলি করার জন্য JSON ফরম্যাট
);

// লগার ইন্সট্যান্স তৈরি
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    // ১. সাধারণ ও আইপি লগ (IP log + General Logs)
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // ৫ এমবি হলে নতুন ফাইল হবে
      maxFiles: '5y',   // ৫ বছর ব্যাকআপ রাখার কনফিগারেশন (5year retention)
      tailable: true    // ফাইল ডিলিট বা মডিফাই হওয়া রোধ করে (immutableLog)
    }),
    
    // ২. হ্যাকিং বা সিকিউরিটি অ্যালার্ট লগ (hackLog)
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/security-hack.log'),
      level: 'warn',
      maxFiles: '5y',
      tailable: true
    })
  ]
);

// ডেভেলপমেন্ট এনভায়রনমেন্টের জন্য কনসোলে প্রিন্ট করার সুবিধা
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// সহজে ব্যবহার করার জন্য কাস্টম এক্সপোর্ট ফাংশনসমূহ
module.exports = {
  // সাধারণ ইনফো এবং আইপি ট্র্যাকিং লগ
  logInfo: (message, ipAddress = 'unknown', metaData = {}) => {
    logger.info(message, { ip: ipAddress, meta: metaData });
  },

  // সন্দেহভাজন হ্যাকিং বা সিকিউরিটি অ্যাটাক লগ (hackLog)
  logHackAttempt: (message, ipAddress = 'unknown', metaData = {}) => {
    logger.warn(`[SECURITY ALERT] ${message}`, { 
      ip: ipAddress, 
      isHackAttempt: true, 
      meta: metaData 
    });
  },

  // এরর লগ
  logError: (message, error = null, ipAddress = 'unknown') => {
    logger.error(message, { 
      ip: ipAddress, 
      meta: error ? { message: error.message, stack: error.stack } : {} 
    });
  }
};
