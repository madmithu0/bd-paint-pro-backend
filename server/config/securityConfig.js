const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,https://yourdomain.com')
  .split(',')
  .map((origin) => origin.trim());

// Official Cloudflare IPv4 CIDR prefixes for WAF verification
const cloudflareIpPrefixes = [
  '173.245.48.',
  '103.21.244.',
  '103.22.200.',
  '103.31.4.',
  '141.101.',
  '108.162.',
  '190.93.240.',
  '188.114.96.',
  '197.234.240.',
  '198.41.128.',
  '162.158.',
  '104.16.',
  '104.24.',
  '172.64.',
  '131.0.72.',
];

const securityConfig = {
  helmetOptions: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://googletagmanager.com', 'https://facebook.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://cloudinary.com', 'https://*.amazonaws.com'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        fontSrc: ["'self'", 'https://gstatic.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },

  corsOptions: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or server-to-server webhooks)
      if (!origin || allowedOrigins.includes(origin) || process.env.DEV_MODE === 'true') {
        callback(null, true);
      } else {
        callback(new Error(`CORS Policy Blocked Unauthorized Origin: ${origin}`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Super-Admin-Id', 'X-Super-Token', 'X-Signature'],
    credentials: true,
    maxAge: 86400,
  },

  jwtConfig: {
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    rotateRefreshTokens: true,
  },

  isCloudflareProxyIp(remoteAddress) {
    if (!remoteAddress) return false;
    const cleanIp = remoteAddress.replace('::ffff:', '');
    return cloudflareIpPrefixes.some((prefix) => cleanIp.startsWith(prefix));
  },

  sshAndApiLockdown: {
    apiPrefixLock: '/api/v1/',
    maxFailedSuperAdminAttempts: 3,
    autoBanDurationSeconds: 86400 * 30, // 30 Days ban
    disableSshPasswordAuth: true,
  },
};

module.exports = securityConfig;
