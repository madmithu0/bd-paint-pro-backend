const jwt = require('jsonwebtoken');

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

const generateSuperAdmin2FAToken = ({ superAdminId, clientIp, layers = {} }) => {
  return jwt.sign(
    {
      id: superAdminId,
      role: 'SuperAdmin',
      superAdminId,
      superAdminVerified: true,
      passwordVerified: true,
      twoFactorVerified: true,
      boundIp: clientIp,
      layers: {
        phoneOtp: Boolean(layers.phoneOtp),
        gmailOtp: Boolean(layers.gmailOtp),
      },
      versionLock: 'v3.8.0',
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
};

module.exports = {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  generateSuperAdmin2FAToken,
  generateSuperAdmin4LayerToken: generateSuperAdmin2FAToken,
};
