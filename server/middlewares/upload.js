const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = 'general';

    if (file.fieldname === 'avatar' || file.fieldname === 'profileImage') {
      folder = 'profiles';
    } else if (file.fieldname === 'banner' || file.fieldname === 'bannerImage') {
      folder = 'banners';
    } else if (file.fieldname === 'serviceImage') {
      folder = 'services';
    } else if (file.fieldname === 'materialImage') {
      folder = 'materials';
    } else if (file.fieldname === 'jobImage' || file.fieldname === 'proofImage') {
      folder = 'jobs';
    }

    const fullPath = path.join(uploadDir, folder);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    cb(null, fullPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (jpeg, jpg, png, webp) and pdf are allowed'));
  }
};

module.exports = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: fileFilter
});
