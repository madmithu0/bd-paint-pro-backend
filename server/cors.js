import { env } from './env.js';

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes('*') || env.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600,
};
