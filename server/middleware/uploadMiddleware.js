const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Zero Local Disk Storage: Keep files strictly in RAM buffer
const storage = multer.memoryStorage();

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_MIMES = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/ogg'];

const fileFilter = (req, file, cb) => {
  const allAllowed = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES, ...ALLOWED_AUDIO_MIMES];
  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format: ${file.mimetype}`), false);
  }
};

// Multer Upload Instance (Max 15MB for Live Face Video / Wall Photos)
const uploadMemory = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB limit
  },
});

// Magic-Byte Signature Verification for Images
const verifyMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 4) return false;
  const hex = buffer.toString('hex', 0, 4).toUpperCase();
  // JPEG (FFD8FF), PNG (89504E47), WEBP (52494646)
  return hex.startsWith('FFD8FF') || hex === '89504E47' || hex === '52494646';
};

// Sharp Image Re-encoding (Strips EXIF & Hidden Steganography Malware) + Direct Cloud Stream
const processAndStreamToCloud = async (req, res, next) => {
  try {
    if (!req.file) return next();

    const isImage = ALLOWED_IMAGE_MIMES.includes(req.file.mimetype);
    let uploadBuffer = req.file.buffer;
    let resourceType = 'auto';

    if (isImage) {
      if (!verifyMagicBytes(req.file.buffer)) {
        return res.status(400).json({
          success: false,
          message: 'Security Alert: File magic-byte signature does not match a valid image.',
        });
      }

      // Re-encode image with Sharp to strip all EXIF metadata & hidden payloads
      uploadBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      resourceType = 'image';
    } else if (ALLOWED_VIDEO_MIMES.includes(req.file.mimetype)) {
      resourceType = 'video';
    }

    // Stream directly to Cloudinary without touching local disk
    const uploadResult = await new Promise((resolve, reject) => {
      const cloudStream = cloudinary.uploader.upload_stream(
        {
          folder: 'enterprise_paint_v3',
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      Readable.from(uploadBuffer).pipe(cloudStream);
    });

    req.uploadedMediaUrl = uploadResult.secure_url;
    req.uploadedPublicId = uploadResult.public_id;
    next();
  } catch (error) {
    console.error('[UPLOAD MIDDLEWARE ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Secure media processing and cloud stream failed.',
    });
  }
};

module.exports = {
  uploadSingleImage: uploadMemory.single('photo'),
  uploadBiometricMedia: uploadMemory.single('media'),
  processAndStreamToCloud,
};
