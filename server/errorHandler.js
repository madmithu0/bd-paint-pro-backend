import { logEvent } from './logger.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logEvent('error', 'unhandled_error', {
      ip: req.ip,
      details: { method: req.method, path: req.path, message: err.message, stack: err.stack },
    });
  }

  if (res.headersSent) return next(err);

  if (status >= 500) {
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  return res.status(status).json({ error: err.expose ? err.message : 'Bad request' });
}
