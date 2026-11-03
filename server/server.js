require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const app = require('./app'); // ২ নং ফাইলের সাথে সংযোগ

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

if (!MONGO_URI) {
  console.error("FATAL: MONGODB_URI not defined");
  process.exit(1);
}

// 1. http createServer + 2. socket.io + initSocket
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL === "*" ? true : FRONTEND_URL, // 👈 ১০০% ফিক্স - * হলে true
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: FRONTEND_URL !== "*" // 👈 ১০০% ফিক্স - * হলে false
  }
});
global.io = io;

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// 3. connectDB + autoRestore hook
let isConnecting = false;
async function connectDB() {
  if (isConnecting) return;
  isConnecting = true;
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');
    isConnecting = false;
  } catch (err) {
    console.error('MongoDB connect failed:', err.message);
    isConnecting = false;
    setTimeout(connectDB, 5000);
  }
}

mongoose.connection.on('connected', () => console.log('Mongoose: connected'));
mongoose.connection.on('disconnected', () => {
  console.log('Mongoose: disconnected - autoRestore running');
  connectDB();
});
mongoose.connection.on('error', () => setTimeout(connectDB, 5000));

// 4. healthPing 2sec mongoose ping
function startHealthCheck() {
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
      return;
    }
    try {
      await mongoose.connection.db.admin().ping();
    } catch {
      await connectDB();
    }
  }, 2000);
}

// 5. legalShutdown + PM2 hook
function gracefulShutdown(signal) {
  console.log(`Received ${signal} - shutting down`);
  server.close(() => {
    mongoose.connection.close(false, () => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err.message));
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  gracefulShutdown('uncaughtException');
});

(async () => {
  await connectDB();
  startHealthCheck();
  server.listen(PORT, () => console.log(`✅ Server running on ${PORT} - 100%`));
})();