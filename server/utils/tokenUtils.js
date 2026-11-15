const jwt = require('jsonwebtoken');

// Generate Standard User Access & Refresh Token Pair
const generateTokenPair = (payload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

  return { accessToken, refreshToken };
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
};

// Generate High-Security Super Admin 4-Layer Verified Token (File 161 & 175)
const generateSuperAdmin4LayerToken = ({ superAdminId, clientIp, layers }) => {
  return jwt.sign(
    {
      role: 'SuperAdmin',
      superAdminId,
      superAdminVerified: true,
      boundIp: clientIp,
      layers: {
        phoneOtp: Boolean(layers.phoneOtp),
        gmailOtp: Boolean(layers.gmailOtp),
        voiceVerified: Boolean(layers.voiceVerified),
        face3DVerified: Boolean(layers.face3DVerified),
      },
      versionLock: 'v3.0.0',
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
};

module.exports = {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  generateSuperAdmin4LayerToken,
};
