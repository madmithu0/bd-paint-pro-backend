require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

if (!MONGO_URI) {
  console.error("FATAL: MONGODB_URI not defined");
  process.exit(1);
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});

global.io = io;

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

let isConnecting = false;
async function connectDB() {
  if (isConnecting) return;
  isConnecting = true;
  try {
    await mongoose.connect(MONGO_URI);
    isConnecting = false;
  } catch (err) {
    isConnecting = false;
    setTimeout(connectDB, 5000);
  }
}

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('disconnected', () => {
  connectDB();
});

mongoose.connection.on('error', () => {
  setTimeout(connectDB, 5000);
});

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

function gracefulShutdown(signal) {
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  gracefulShutdown('uncaughtException');
});

(async () => {
  await connectDB();
  startHealthCheck();
  server.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
  });
})();