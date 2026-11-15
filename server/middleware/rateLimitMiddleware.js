const Redis = require('ioredis');
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const HackLog = require('../models/HackLog');

let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  redisClient.on('error', (err) => {
    console.warn('⚠️ [RATE LIMIT REDIS NOTICE] Using memory fallback:', err.message);
  });
}

// Memory Fallbacks for Self-Healing Continuity
const memoryGlobalLimiter = new RateLimiterMemory({ points: 120, duration: 60 });
const memoryAuthLimiter = new RateLimiterMemory({ points: 8, duration: 300, blockDuration: 900 });
const memoryPaymentLimiter = new RateLimiterMemory({ points: 15, duration: 60 });

// Redis-Backed Limiters
const globalLimiter = redisClient
  ? new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl_global',
      points: 120, // 120 requests per minute per IP
      duration: 60,
      insuranceLimiter: memoryGlobalLimiter,
    })
  : memoryGlobalLimiter;

const authLimiter = redisClient
  ? new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl_auth',
      points: 8, // Max 8 login/OTP attempts per 5 minutes
      duration: 300,
      blockDuration: 900, // Block for 15 minutes on brute-force
      insuranceLimiter: memoryAuthLimiter,
    })
  : memoryAuthLimiter;

const paymentLimiter = redisClient
  ? new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl_payment',
      points: 15, // Max 15 payment API calls per minute
      duration: 60,
      insuranceLimiter: memoryPaymentLimiter,
    })
  : memoryPaymentLimiter;

const createLimiterMiddleware = (limiter, attackCategory = 'Bot') => {
  return async (req, res, next) => {
    const clientIp = req.clientIp || req.ip || '127.0.0.1';
    try {
      await limiter.consume(clientIp);
      next();
    } catch (rejRes) {
      // Log Brute-Force / Bot Spike to HackLog
      HackLog.create({
        hackIp: clientIp,
        cloudflareRayId: req.cfRay || 'N/A',
        device: req.headers['user-agent'] || 'Unknown',
        attackType: attackCategory,
        endpoint: req.originalUrl,
        action: 'RATE_LIMIT_BLOCKED',
      }).catch(() => {});

      const retrySecs = Math.round(rejRes.msBeforeNext / 1000) || 60;
      res.set('Retry-After', String(retrySecs));
      return res.status(429).json({
        success: false,
        message: `Too many requests detected. Please try again after ${retrySecs} seconds.`,
      });
    }
  };
};

module.exports = {
  globalRateLimiter: createLimiterMiddleware(globalLimiter, 'Bot'),
  authRateLimiter: createLimiterMiddleware(authLimiter, 'BruteForce'),
  paymentRateLimiter: createLimiterMiddleware(paymentLimiter, 'BruteForce'),
};
