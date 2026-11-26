const rawOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,https://yourdomain.com'
)
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const cloudflareIpPrefixes = [
  '173.245.48.', '103.21.244.', '103.22.200.', '103.31.4.',
  '141.101.', '108.162.', '190.93.240.', '188.114.96.',
  '197.234.240.', '198.41.128.', '162.158.', '104.16.',
  '104.24.', '172.64.', '131.0.72.',
];

const isAllowedOrigin = (origin) => {
  if (!origin || process.env.DEV_MODE === 'true') return true;
  const cleanOrigin = origin.trim().replace(/\/+$/, '');
  if (rawOrigins.includes('*') || rawOrigins.includes(cleanOrigin)) return true;
  return /^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(cleanOrigin);
};

const securityConfig = {
  appVersion: 'v3.8.0',
  helmetOptions: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://googletagmanager.com', 'https://facebook.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://cloudinary.com', 'https://cloudinary.com', 'https://*.amazonaws.com'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        fontSrc: ["'self'", 'https://gstatic.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  },
  corsOptions: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) callback(null, true);
      else callback(new Error(`CORS Policy Blocked Unauthorized Origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 'Authorization', 'X-Requested-With',
      'X-App-Version', 'X-Super-Admin-Id', 'X-Super-Token', 'X-Signature', 'X-Transaction-Pin',
    ],
    credentials: true,
    maxAge: 86400,
  },
  mongoSanitizeOptions: {
    replaceWith: '_',
  },
  passwordPolicy: {
    minLength: 8,
    maxLength: 64,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
    maxFailedAttempts: 5,
    lockDurationMs: 30 * 60 * 1000,
    passwordHistoryLimit: 3,
  },
  jwtConfig: {
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    accessExpiry: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    superAdminSessionExpiry: '2h',
    rotateRefreshTokens: true,
  },
  isCloudflareProxyIp(remoteAddress) {
    if (!remoteAddress) return false;
    const cleanIp = remoteAddress.replace(/^::ffff:/, '');
    return cloudflareIpPrefixes.some((prefix) => cleanIp.startsWith(prefix));
  },
  sshAndApiLockdown: {
    apiPrefixLock: '/api/v1/',
    superAdminRoute: process.env.SUPER_ADMIN_ROUTE || '/x9-super-2026',
    maxFailedSuperAdminAttempts: 3,
    autoBanDurationSeconds: 86400 * 30,
    disableSshPasswordAuth: true,
  },
};

module.exports = securityConfig;
