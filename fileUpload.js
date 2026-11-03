/**
 * fileUpload.js
 * ফিচারসমূহ: Multer Profile Photo, Image Compression, MIME ImageOnly Check, 
 * Watermark with GPS Info, Shell Block Protection, এবং 2MB Size Limit।
 */

const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ফাইল সেভ করার ডিরেক্টরি সেটআপ
const UPLOAD_DIR = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// মেমোরি স্টোরেজ ব্যবহার করা হচ্ছে যেন শার্প (Sharp) দিয়ে প্রসেস করার পর ফাইল ডিস্কে সেভ হয়
const storage = multer.memoryStorage();

// ১. ফাইল টাইপ এবং শেল ব্লক চেক (mime imageOnly + shell block)
const fileFilter = (req, file, cb) => {
  // ক) শুধুমাত্র ইমেজ ফাইলের MIME টাইপ অ্যালাউ করা (mime imageOnly)
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, and WEBP images are allowed!'), false);
  }

  // খ) এক্সটেনশন লেভেলে শেল ব্লক প্রটেকশন (shell block)
  // ডাবল এক্সটেনশন বা ক্ষতিকর স্ক্রিপ্ট এক্সটেনশন (.php, .sh, .js, .exe) ব্লক করা
  const fileExt = path.extname(file.originalname).toLowerCase();
  const dangerousExts = ['.php', '.sh', '.js', '.exe', '.bat', '.py'];
  
  if (dangerousExts.includes(fileExt) || file.originalname.includes('\0')) {
    return cb(new Error('Security Alert: Dangerous file upload attempt blocked!'), false);
  }

  cb(null, true);
};

// ২. মাল্টার কনফিগারেশন এবং ২ এমবি সাইজ লিমিট (multer + 2MB limit)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // ২ মেগাবাইট বা 2MB সর্বোচ্চ সাইজ লিমিট
  }
}).single('profilePhoto'); // প্রোফাইল ফটোর ফিল্ড নেম (profilePhoto self)


// ৩. ইমেজ কম্প্রেশন এবং জিপিএস ওয়াটারমার্ক মিডলওয়্যার (image compress + watermark Gps)
const processProfilePhoto = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a profile photo.' });
  }

  try {
    const filename = `profile-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const outputPath = path.join(UPLOAD_DIR, filename);

    // জিপিএস ডাটা বা লোকেশন টেক্সট (watermark Gps)
    // ক্লায়েন্ট থেকে কো-অর্ডিনেট পাঠালে তা ব্যবহার করবে, না হলে ডিফল্ট টেক্সট বসবে
    const lat = req.body.latitude || 'N/A';
    const lng = req.body.longitude || 'N/A';
    const watermarkText = `GPS: Lat ${lat}, Lng ${lng} | ${new Date().toISOString().split('T')[0]}`;

    // ওয়াটারমার্কের জন্য SVG ইমেজ তৈরি
    const svgText = `
      <svg width="400" height="40">
        <style>
          .watermark { font-family: sans-serif; font-size: 14px; fill: white; font-weight: bold; }
          .bg { fill: rgba(0, 0, 0, 0.5); }
        </style>
        <rect width="400" height="40" class="bg" />
        <text x="10" y="25" class="watermark">${watermarkText}</text>
      </svg>
    `;
    const watermarkBuffer = Buffer.from(svgText);

    // Sharp লাইব্রেরি দিয়ে ইমেজ প্রসেসিং (image compress + watermark)
    await sharp(req.file.buffer)
      .resize(500, 500, { fit: 'cover' }) // প্রোফাইল ফটোর জন্য স্কয়ার সাইজ রিসাইজ
      .webp({ quality: 80 })             // ইমেজ কম্প্রেশন (৮০% কোয়ালিটি দিয়ে ফাইল সাইজ কমানো)
      .composite([{
        input: watermarkBuffer,
        gravity: 'southwest'             // ছবির নিচে বাম কোণায় ওয়াটারমার্ক বসবে
      }])
      .toFile(outputPath);

    // পরবর্তী মিডলওয়্যার বা কন্ট্রোলারে ব্যবহারের জন্য ফাইল পাথটি সেট করা
    req.savedProfilePhoto = `/uploads/profiles/${filename}`;
    next();

  } catch (error) {
    return res.status(500).json({
      status: 'UPLOAD_PROCESSING_ERROR',
      message: 'Failed to process and compress the image.',
      error: error.message
    });
  }
};

module.exports = {
  uploadProfilePhoto: (req, res, next) => {
    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size limit exceeded. Maximum limit is 2MB.' });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  processProfilePhoto
};
