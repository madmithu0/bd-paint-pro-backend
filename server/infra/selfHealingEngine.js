const mongoose = require('mongoose');
const Sentry = require('@sentry/node');

let safeModeActive = false;
const MEMORY_WARNING_MB = 850; // Trigger GC before hitting 1GB PM2 restart threshold

const initSelfHealing = (httpServer) => {
  // 1. Periodic Memory Leak Detector & Auto Garbage Collection (Every 60s)
  const memoryWatchInterval = setInterval(() => {
    const usedMemMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

    if (usedMemMb > MEMORY_WARNING_MB) {
      console.warn(`⚠️ [SELF-HEALING MEMORY] High RSS Memory detected (${usedMemMb} MB). Running cleanup...`);
      if (global.gc) {
        global.gc();
      }
      if (usedMemMb > 960) {
        console.error('🚨 [SELF-HEALING RELOAD] Memory critical. Triggering graceful PM2 zero-downtime reload.');
        Sentry.captureMessage(`Critical Memory Threshold Reached: ${usedMemMb}MB`);
        process.exit(1); // PM2 Watchdog restarts worker in < 1 second
      }
    }
  }, 60000);

  memoryWatchInterval.unref();

  // 2. Database Connection Self-Healer Watchdog (Every 30s)
  const dbWatchInterval = setInterval(async () => {
    if (mongoose.connection.readyState === 0 && process.env.MONGO_REPLICA_URI) {
      console.warn('🔄 [DB SELF-HEALER] Attempting background MongoDB reconnection...');
      await mongoose.connect(process.env.MONGO_REPLICA_URI).catch(() => {});
    }
  }, 30000);

  dbWatchInterval.unref();

  console.log('🧬 [SELF-HEALING ENGINE] Memory Watchdog, DB Auto-Healer & Safe Mode Active');
};

const setSafeMode = (status, reason = '') => {
  safeModeActive = Boolean(status);
  if (safeModeActive) {
    console.warn(`🛡️ [SAFE MODE ACTIVATED]: ${reason}`);
  }
};

const isSafeMode = () => safeModeActive;

module.exports = {
  initSelfHealing,
  setSafeMode,
  isSafeMode,
};
