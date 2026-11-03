/**
 * validator.js
 * ফিচারসমূহ: BD Phone Regex, Gmail Regex, Photo MIME Check, BIN + Mushak Validation, 
 * এবং Anti-Injection (noShell, noPHP, noJS) Protection.
 */

module.exports = {
  
  // ১. বাংলাদেশী ফোন নম্বর ভ্যালিডেশন (BD phone regex)
  // +8801XXXXXXXXX অথবা 01XXXXXXXXX ফরম্যাট সাপোর্ট করবে
  validateBDPhone: (phone) => {
    const bdPhoneRegex = /^(?:\+88)?01[3-9]\d{8}$/;
    return bdPhoneRegex.test(phone);
  },

  // ২. শুধুমাত্র জিমেইল অ্যাকাউন্ট ভ্যালিডেশন (gmail regex)
  validateGmail: (email) => {
    // জিমেইল অ্যাড্রেস লোয়ারকেস করে স্ট্যান্ডার্ড চেক করা
    const gmailRegex = /^[a-z0-9](\.?[a-z0-9]){4,29}@gmail\.com$/;
    return gmailRegex.test(String(email).toLowerCase());
  },

  // ৩. ফটোর টাইপ বা এক্সটেনশন ভ্যালিডেশন (photo mime check)
  // শুধুমাত্র স্ট্যান্ডার্ড ইমেজ ফাইল (JPEG, PNG, WEBP) অনুমতি দেবে
  validatePhotoMime: (mimeType) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return allowedMimeTypes.includes(mimeType);
  },

  // ৪. বিআইএন এবং মূসক নম্বর ভ্যালিডেশন (BIN + Mushak)
  // বাংলাদেশে বর্তমানে ১৩ ডিজিটের বিজনেস আইডেন্টিফিকেশন নাম্বার (BIN) বা মূসক ব্যবহৃত হয়
  validateBIN: (binNumber) => {
    const binRegex = /^\d{13}$/;
    return binRegex.test(binNumber);
  },

  // ৫. মেলিশিয়াস স্ক্রিপ্ট ও ইনজেকশন প্রোটেকশন (noShell noPHP noJS)
  // ইউজার ইনপুটের ভেতর কোনো ক্ষতিকর কোড বা স্ক্রিপ্ট থাকলে তা ব্লক করবে
  sanitizeAndValidateInput: (inputData) => {
    if (typeof inputData !== 'string') return true;

    // ক) নো শেল ইনজেকশন (noShell) - কমান্ড এক্সিকিউশন ক্যারেক্টার ব্লক
    const shellPatterns = /[|&;$`><]/g;
    
    // খ) নো পিএইচপি কোড (noPHP) - PHP ট্যাগ ব্লক
    const phpPatterns = /<\?php|<\?|=\?>/gi;
    
    // গ) নো জাভাস্ক্রিপ্ট / এক্সএসএস (noJS) - স্ক্রিপ্ট ট্যাগ ও অন-ক্লিক ইভেন্ট ব্লক
    const jsPatterns = /<script\b[^>]*>([\s\S]*?)<\/script>|javascript:|onerror=|onclick=/gi;

    if (shellPatterns.test(inputData) || phpPatterns.test(inputData) || jsPatterns.test(inputData)) {
      return false; // মেলিশিয়াস কোড পাওয়া গেছে, ইনপুট অবৈধ
    }

    return true; // ইনপুট নিরাপদ
  },

  // এক্সপ্রেস মিডলওয়্যার: রিকোয়েস্ট বডি ও প্যারামস যাচাই করার জন্য
  validationMiddleware: (req, res, next) => {
    const inputs = { ...req.body, ...req.query, ...req.params };

    for (const key in inputs) {
      if (Object.prototype.hasOwnProperty.call(inputs, key)) {
        const isSafe = module.exports.sanitizeAndValidateInput(inputs[key]);
        if (!isSafe) {
          return res.status(400).json({
            status: "SECURITY_VIOLATION",
            message: `Malicious or illegal characters detected in field: ${key}`
          });
        }
      }
    }
    next();
  }
};
