const Redis = require('ioredis');

let redis = null;
let isRedisHealthy = false;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });

  redis.on('connect', () => {
    isRedisHealthy = true;
    console.log('⚡ [REDIS CACHE] Connected and Ready');
  });

  redis.on('error', (err) => {
    isRedisHealthy = false;
    console.warn('⚠️ [REDIS BYPASS] Redis unavailable, auto-bypassing to MongoDB:', err.message);
  });
}

const setCache = async (key, data, ttlSeconds = 300) => {
  if (!redis || !isRedisHealthy) return false;
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    return true;
  } catch (err) {
    return false;
  }
};

const getCache = async (key) => {
  if (!redis || !isRedisHealthy) return null;
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    return null;
  }
};

const clearCache = async (keyPattern) => {
  if (!redis || !isRedisHealthy) return false;
  try {
    if (keyPattern.includes('*')) {
      const keys = await redis.keys(keyPattern);
      if (keys.length > 0) await redis.del(keys);
    } else {
      await redis.del(keyPattern);
    }
    return true;
  } catch (err) {
    return false;
  }
};

module.exports = {
  setCache,
  getCache,
  clearCache,
  isRedisAvailable: () => isRedisHealthy,
};
