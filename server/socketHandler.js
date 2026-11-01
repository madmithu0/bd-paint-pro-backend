import { Server } from 'socket.io';
import { corsOptions } from './cors.js';
import { verifyToken } from './jwt.js';

export function attachSocket(httpServer) {
  const io = new Server(httpServer, { cors: corsOptions });

  io.use((socket, next) => {
    try {
      socket.data.user = verifyToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.user.sub}`);
  });

  return io;
}
