import { env } from './env.js';

export function maintenanceMode(req, res, next) {
  if (!env.maintenanceMode || req.path === '/api/health') return next();
  return res.status(503).json({ error: 'The service is under maintenance. Please try again later.' });
}
