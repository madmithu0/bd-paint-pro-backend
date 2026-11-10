const mongoose = require('mongoose');
const env = require('./config/env');

if (!env.mongo || !env.mongo.startsWith('mongodb')) {
  throw new Error('MONGO_URI missing or invalid');
}

let retryCount = 0;
let isConnecting = false;

async function connectDB() {
  if (isConnecting || mongoose.connection.readyState === 1) return;
  isConnecting = true;
  try {
    await mongoose.connect(env.mongo, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    });
    console.log('MongoDB connected');
    retryCount = 0;
  } catch (e) {
    console.error('MongoDB connect fail:', e.message);
    retryCount += 1;
    const delay = Math.min(5000 * retryCount, 30000);
    setTimeout(() => {
      isConnecting = false;
      connectDB();
    }, delay);
    return;
  }
  isConnecting = false;
}

mongoose.connection.on('disconnected', () => {
  setTimeout(() => {
    isConnecting = false;
    connectDB();
  }, 5000);
});

mongoose.connection.on('error', (e) => {
  console.error('MongoDB error:', e.message);
});

module.exports = connectDB;