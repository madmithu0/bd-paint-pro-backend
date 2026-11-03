const { Server } = require('socket.io');
const winston = require('winston');
const path = require('path');

// চ্যাট লগ ৫ বছর সংরক্ষণের জন্য আলাদা উইনস্টন লগার (chatLog 5year)
const chatLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/chat-history.log'),
      maxFiles: '5y', // ৫ বছর ডেটা রাখার কনফিগারেশন
      tailable: true 
    })
  ]
});

// ফ্লড প্রোটেকশন বা স্প্যামিং রোধের জন্য ট্র্যাকিং অবজেক্ট (no flood)
const messageTimestamps = new Map();
const FLOOD_LIMIT_MS = 1000; // ১ সেকেন্ডে ১টির বেশি মেসেজ পাঠানো যাবে না

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*", // আপনার ফ্রন্টএন্ড ইউআরএল অনুযায়ী এটি পরিবর্তন করে নেবেন
      methods: ["GET", "POST"]
    }
  });

  // সকেট অথেন্টিকেশন মিডলওয়্যার (socket auth)
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
    
    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      // এখানে আপনার JWT ভেরিফিকেশন লজিক বসবে (যেমন: jwt.js থেকে)
      // উদাহরণস্বরূপ একটি ডামি ইউজার অবজেক্ট যুক্ত করা হলো:
      socket.user = { id: "user_123", name: "Test User" }; 
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  // কানেকশন হ্যান্ডলার
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}`);

    // ১. লাইভ লোকেশন ট্র্যাকিং (liveTracking)
    socket.on('update_location', (data) => {
      const { latitude, longitude } = data;
      
      // ইউজারের লাইভ লোকেশন নির্দিষ্ট রুমে বা সবাইকে ব্রডকাস্ট করা
      socket.broadcast.emit('location_updated', {
        userId: socket.user.id,
        latitude,
        longitude,
        timestamp: new Date()
      });
    });

    // ২. চ্যাট সিস্টেম (chat + chatLog 5year + no flood)
    socket.on('send_message', (data) => {
      const currentTime = Date.now();
      const lastMessageTime = messageTimestamps.get(socket.user.id) || 0;

      // ফ্লড প্রোটেকশন চেক (no flood)
      if (currentTime - lastMessageTime < FLOOD_LIMIT_MS) {
        socket.emit('error_response', { message: "Too many messages! Please wait a moment." });
        return;
      }

      // টাইমস্ট্যাম্প আপডেট
      messageTimestamps.set(socket.user.id, currentTime);

      const chatMessage = {
        senderId: socket.user.id,
        receiverId: data.receiverId,
        message: data.message,
        timestamp: new Date()
      };

      // চ্যাট মেসেজ সেভ করা (chatLog 5year)
      chatLogger.info('Chat Message', chatMessage);

      // নির্দিষ্ট রুমে বা রিসিভারকে মেসেজ পাঠানো
      io.to(data.receiverId).emit('receive_message', chatMessage);
    });

    // ডিসকানেক্ট হ্যান্ডলার
    socket.on('disconnect', () => {
      messageTimestamps.delete(socket.user.id);
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });

  return io;
}

module.exports = initializeSocket;
