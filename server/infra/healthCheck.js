const express = require('express');
const os = require('os');
const mongoose = require('mongoose');
const router = express.Router();
const { isRedisAvailable } = require('../utils/cacheUtils');
const { isSafeMode } = require('./selfHealingEngine');

// @route   GET /api/v1/health
// @desc    Deep System Pulse Endpoint for PM2 Watchdog & CI/CD Auto-Rollback
// @access  Public / Load Balancer
router.get('/', async (req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  const redisConnected = isRedisAvailable();
  const memoryRssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const uptimeSeconds = Math.round(process.uptime());
  const cpuLoad = os.loadavg();
  const load1m = Array.isArray(cpuLoad) ? cpuLoad[0] : Number(cpuLoad || 0);

  const isHealthy = mongoConnected && memoryRssMb < 1000;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'HEALTHY' : 'DEGRADED',
    version: 'v3.0.0 SELF-HEALING LOCK',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    services: {
      mongodb: mongoConnected ? 'UP' : 'DOWN',
      redis: redisConnected ? 'UP' : 'BYPASS_ACTIVE',
      safeMode: isSafeMode() ? 'ON' : 'OFF',
    },
    resources: {
      memoryRssMb,
      memoryLimitMb: 1024,
      cpuLoad1m: Number(load1m.toFixed(2)),
    },
  });
});

module.exports = router;
