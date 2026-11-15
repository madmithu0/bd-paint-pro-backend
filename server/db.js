const mongoose = require('mongoose');
const Sentry = require('@sentry/node');

let isConnected = false;
let retryCount = 0;
const MAX_RETRY_DELAY_MS = 30000;

const connectDB = async () => {
  const mongoURI = process.env.MONGO_REPLICA_URI;

  if (!mongoURI) {
    throw new Error('MONGO_REPLICA_URI is missing in server/.env file');
  }

  mongoose.set('strictQuery', true);

  const options = {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    readPreference: 'primaryPreferred',
    retryWrites: true,
    w: 'majority',
  };

  const attemptConnection = async () => {
    try {
      await mongoose.connect(mongoURI, options);
      isConnected = true;
      retryCount = 0;
      console.log('✅ [MONGODB] Replica Set Connected (Primary + Secondary Failover Ready)');
      initOplogChangeStreams();
    } catch (err) {
      isConnected = false;
      retryCount += 1;
      const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_RETRY_DELAY_MS);
      console.error(`❌ [MONGODB ERROR] Connection failed (Attempt ${retryCount}): ${err.message}`);
      console.warn(`🔄 [MONGODB RETRY] Retrying in ${delay / 1000} seconds...`);
      Sentry.captureException(err);

      await new Promise((resolve) => setTimeout(resolve, delay));
      return attemptConnection();
    }
  };

  // Connection Event Listeners for Self-Healing
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('⚠️ [MONGODB DISCONNECT] Lost connection to Replica Set. Initiating auto-reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('✅ [MONGODB RECONNECTED] Replica Set connection restored.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ [MONGODB RUNTIME ERROR]:', err.message);
    Sentry.captureException(err);
  });

  await attemptConnection();
};

// Oplog Change Stream Init for Real-Time CDC Backup & Sync (File 65 & 186)
const initOplogChangeStreams = () => {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const changeStream = db.watch([], { fullDocument: 'updateLookup' });

    changeStream.on('change', (change) => {
      // Emits database mutation events for 10-min incremental backup queue
      if (process.emit) {
        process.emit('db:oplog_change', {
          operationType: change.operationType,
          collection: change.ns?.coll,
          documentKey: change.documentKey?._id,
          timestamp: new Date(),
        });
      }
    });

    changeStream.on('error', (err) => {
      console.warn('⚠️ [OPLOG STREAM NOTICE] Change stream requires MongoDB Replica Set:', err.message);
    });

    console.log('📡 [OPLOG CDC] Real-Time Change Stream Listener Initialized');
  } catch (error) {
    console.warn('⚠️ [OPLOG INIT SKIPPED]:', error.message);
  }
};

module.exports = connectDB;
