const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

const avatarFileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, or WebP images are allowed for profile avatar'), false);
  }
};

const uploadMemory = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

const uploadAvatarMemory = multer({
  storage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

const verifyMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 4) return false;
  const hex = buffer.toString('hex', 0, 4).toUpperCase();
  return hex.startsWith('FFD8FF') || hex === '89504E47' || hex === '52494646';
};

const streamBufferToCloudinary = (buffer, folder, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    const cloudStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(cloudStream);
  });
};

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

      uploadBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      resourceType = 'image';
    } else if (ALLOWED_VIDEO_MIMES.includes(req.file.mimetype)) {
      resourceType = 'video';
    }
    const uploadResult = await streamBufferToCloudinary(
      uploadBuffer,
      'enterprise_paint_v3',
      resourceType
    );

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

const processAvatarAndStreamToCloud = async (req, res, next) => {
  try {
    if (!req.file) return next();

    if (!verifyMagicBytes(req.file.buffer)) {
      return res.status(400).json({
        success: false,
        message: 'Security Alert: Invalid avatar image file signature.',
      });
    }

    const avatarBuffer = await sharp(req.file.buffer)
      .rotate()
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();

    const uploadResult = await streamBufferToCloudinary(
      avatarBuffer,
      'enterprise_paint_v3/avatars',
      'image'
    );

    req.uploadedMediaUrl = uploadResult.secure_url;
    req.uploadedPublicId = uploadResult.public_id;
    next();
  } catch (error) {
    console.error('[AVATAR UPLOAD ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Avatar image processing failed.',
    });
  }
};

const deleteCloudAsset = async (publicId) => {
  if (!publicId) return false;
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error('[CLOUDINARY DELETE ERROR]:', error.message);
    return false;
  }
};

module.exports = {
  uploadSingleImage: uploadMemory.single('photo'),
  uploadAvatarImage: uploadAvatarMemory.single('avatar'),
  uploadBiometricMedia: uploadMemory.single('media'),
  processAndStreamToCloud,
  processAvatarAndStreamToCloud,
  deleteCloudAsset,
};
