import http from 'node:http';
import app from './app.js';
import { env } from './env.js';
import { logEvent } from './logger.js';
import { attachSocket } from './socketHandler.js';

const server = http.createServer(app);
const io = attachSocket(server);

server.listen(env.port, '0.0.0.0', () => {
  logEvent('info', 'server_started', { details: { port: env.port, host: '0.0.0.0' } });
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  await logEvent('info', 'server_shutdown', { details: { signal } });
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();
  io.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logEvent('error', 'unhandled_rejection', {
    details: { message: reason instanceof Error ? reason.message : String(reason) },
  });
});
