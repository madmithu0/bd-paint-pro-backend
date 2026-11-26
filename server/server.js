require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const Sentry = require('@sentry/node');

const safeRequire = (modulePath, fallback = null) => {
  try {
    return require(modulePath);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn(`[SAFE-LOADER] Optional/Pending module skipped: ${modulePath}`);
      return fallback;
    }
    throw err;
  }
};

const connectDB = require('./db');
const paymentConfig = safeRequire('./config/paymentConfig', { validateConfig: () => true });
const securityConfig = safeRequire('./config/securityConfig', { helmetOptions: {}, corsOptions: {} });
const { seedDefaultServiceRates } = safeRequire('./seed/serviceRateSeed', { seedDefaultServiceRates: async () => {} });

const { initAutoBackup } = safeRequire('./utils/backupUtils', { initAutoBackup: () => {} });
const { banIpAuto } = safeRequire('./utils/wafSecurityUtils', { banIpAuto: async () => {} });
const { verifyGovtCompliance } = safeRequire('./utils/govtUtils', { verifyGovtCompliance: async () => {} });
const { verifyHmacSignature } = safeRequire('./utils/signatureUtils', { verifyHmacSignature: () => true });
const { initSelfHealing } = safeRequire('./infra/selfHealingEngine', { initSelfHealing: () => {} });
const healthCheckRouter = safeRequire('./infra/healthCheck', express.Router());

const { verifyToken } = safeRequire('./middleware/authMiddleware', { verifyToken: (req, res, next) => next() });
const { checkKillSwitch } = safeRequire('./middleware/killMiddleware', { checkKillSwitch: (req, res, next) => next() });
const { auditLogger } = safeRequire('./middleware/auditMiddleware', { auditLogger: (req, res, next) => next() });
const { globalRateLimiter } = safeRequire('./middleware/rateLimitMiddleware', { globalRateLimiter: (req, res, next) => next() });
const { globalErrorHandler, notFoundHandler } = safeRequire('./middleware/errorMiddleware', {
  notFoundHandler: (req, res) => res.status(404).json({ success: false, message: 'Endpoint not found' }),
  globalErrorHandler: (err, req, res, next) => res.status(500).json({ success: false, message: 'Internal Server Error' }),
});

const APP_VERSION = 'v3.8.0';
const ARCHITECTURE_LOCK = 'PASSWORD + 2FA LOCK';
const API_PREFIX = '/api/v1';

const rawSuperRoute = (
  process.env.SUPER_ADMIN_ROUTE ||
  process.env.SUPER_ADMIN_SECRET_ROUTE ||
  '/x9-super-2026'
).trim();
const SECRET_SUPER_ROUTE = rawSuperRoute.startsWith('/') ? rawSuperRoute : `/${rawSuperRoute}`;

if (process.env.APP_VERSION && process.env.APP_VERSION !== APP_VERSION) {
  console.error(`[FATAL] Version Lock Mismatch! Expected ${APP_VERSION}, found ${process.env.APP_VERSION}`);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    release: `enterprise-app@${APP_VERSION}`,
    tracesSampleRate: 0.2,
  });
}

const io = new Server(server, {
  cors: securityConfig.corsOptions,
  pingTimeout: 60000,
});
app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => {
    if (roomId) socket.join(roomId);
  });
  socket.on('disconnect', () => {});
});

app.set('trust proxy', 1);

app.locals.systemConfig = {
  version: APP_VERSION,
  lock: ARCHITECTURE_LOCK,
  defaultSqftPerDay: 450,
  dynamicServiceSlots: true,
  advanceGatePercent: 0.30,
  aiConfidenceThreshold: 0.80,
  biometricsRemoved: true,
  shareSplit: {
    mistri: 0.80,
    agentWithAgent: 0.05,
    platformWithAgent: 0.15,
    platformNoAgent: 0.20,
  },
  superAdminPassword2FAActive: true,
  hideAfterMinutes: 0,
  autoHideEnabled: false,
};

app.use(helmet(securityConfig.helmetOptions));
app.use(cors(securityConfig.corsOptions));
app.use(compression());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(mongoSanitize({ replaceWith: '_' }));
app.use(hpp());

app.use((req, res, next) => {
  const cfRay = req.headers['cf-ray'];
  const rawIp = req.headers['cf-connecting-ip'] || req.ip || '';
  const clientIp = String(rawIp).replace(/^::ffff:/, '').trim();
  req.clientIp = clientIp;
  req.cfRay = cfRay || 'LOCAL-DEV';

  if (process.env.NODE_ENV === 'production' && process.env.ENFORCE_CLOUDFLARE === 'true' && !cfRay) {
    return res.status(403).json({
      success: false,
      message: 'Direct server access blocked. Cloudflare WAF verification required.',
    });
  }
  next();
});

app.use(globalRateLimiter);
app.use(auditLogger);

app.use(`${API_PREFIX}/health`, healthCheckRouter);

const paymentWebhookRouter = express.Router();
paymentWebhookRouter.post('/bkash/callback', verifyHmacSignature, (req, res, next) => {
  const bkashLive = safeRequire('./services/payment/bkashLive');
  if (bkashLive && bkashLive.handleCallback) return bkashLive.handleCallback(req, res, next);
  res.status(200).json({ status: 'Webhook endpoint ready' });
});
paymentWebhookRouter.post('/nagad/callback', verifyHmacSignature, (req, res, next) => {
  const nagadLive = safeRequire('./services/payment/nagadLive');
  if (nagadLive && nagadLive.handleCallback) return nagadLive.handleCallback(req, res, next);
  res.status(200).json({ status: 'Webhook endpoint ready' });
});
app.use(`${API_PREFIX}/webhooks`, paymentWebhookRouter);

const failedSuperAdminAttempts = new Map();

const superAdminIpGuard = async (req, res, next) => {
  const allowedIps = (process.env.SUPER_ADMIN_IP || '').split(',').map((ip) => ip.trim()).filter(Boolean);
  if (allowedIps.length > 0 && !allowedIps.includes(req.clientIp)) {
    const attempts = (failedSuperAdminAttempts.get(req.clientIp) || 0) + 1;
    failedSuperAdminAttempts.set(req.clientIp, attempts);

    if (attempts >= 3) {
      await banIpAuto(req.clientIp, '3 Failed Unauthorized Super Admin Route Access Attempts');
      failedSuperAdminAttempts.delete(req.clientIp);
    }
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  next();
};

const superAdminRoutes = safeRequire('./routes/super/superAdminRoutes', express.Router());
app.use(
  `${API_PREFIX}${SECRET_SUPER_ROUTE}`,
  superAdminIpGuard,
  superAdminRoutes
);

app.use(API_PREFIX, checkKillSwitch);

const routeRegistry = [
  { path: '/auth', file: './routes/authRoutes', protected: false },
  { path: '/services', file: './routes/serviceCategoryRoutes', protected: false },
  { path: '/warranties', file: './routes/warrantyRoutes', protected: false },
  { path: '/seo', file: './routes/seoRoutes', protected: false },
  { path: '/users', file: './routes/userRoutes', protected: true },
  { path: '/jobs', file: './routes/jobRoutes', protected: true },
  { path: '/teams', file: './routes/teamRoutes', protected: true },
  { path: '/payments', file: './routes/paymentRoutes', protected: true },
  { path: '/chats', file: './routes/chatRoutes', protected: true },
  { path: '/attendance', file: './routes/attendanceRoutes', protected: true },
  { path: '/reviews', file: './routes/reviewRoutes', protected: true },
  { path: '/disputes', file: './routes/disputeRoutes', protected: true },
  { path: '/notifications', file: './routes/notificationRoutes', protected: true },
  { path: '/reports', file: './routes/reportRoutes', protected: true },
  { path: '/invoices', file: './routes/invoiceRoutes', protected: true },
  { path: '/schedules', file: './routes/scheduleRoutes', protected: true },
  { path: '/search', file: './routes/searchRoutes', protected: true },
  { path: '/materials', file: './routes/materialRoutes', protected: true },
  { path: '/merchant-store', file: './routes/merchantStoreRoutes', protected: true },
  { path: '/sms', file: './routes/smsRoutes', protected: true },
  { path: '/wallet', file: './routes/walletRoutes', protected: true },
  { path: '/kill', file: './routes/killRoutes', protected: true },
  { path: '/backup', file: './routes/backupRoutes', protected: true },
  { path: '/govt', file: './routes/govtRoutes', protected: true },
];

routeRegistry.forEach((route) => {
  const routerInstance = safeRequire(route.file);
  if (routerInstance) {
    if (route.protected) {
      app.use(`${API_PREFIX}${route.path}`, verifyToken, routerInstance);
    } else {
      app.use(`${API_PREFIX}${route.path}`, routerInstance);
    }
  }
});

if (process.env.SENTRY_DSN && Sentry.setupExpressErrorHandler) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(notFoundHandler);
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;
const isPrimaryClusterInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';

const startServer = async () => {
  try {
    await connectDB();

    if (paymentConfig.validateConfig) paymentConfig.validateConfig();
    if (initSelfHealing) initSelfHealing(server);

    if (isPrimaryClusterInstance) {
      if (seedDefaultServiceRates) await seedDefaultServiceRates();
      if (initAutoBackup) initAutoBackup();
      if (verifyGovtCompliance) await verifyGovtCompliance();
    }

    server.listen(PORT, () => {
      console.log(`[BOOT] Enterprise Server ${APP_VERSION} (${ARCHITECTURE_LOCK}) running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[BOOT-FATAL] Server failed to start:', error);
    process.exit(1);
  }
};

const gracefulShutdown = (signal) => {
  console.log(`[SHUTDOWN] Received ${signal}. Closing server gracefully...`);
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
