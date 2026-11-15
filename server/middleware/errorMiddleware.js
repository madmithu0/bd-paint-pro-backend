const Sentry = require('@sentry/node');

// 404 Route Not Found Handler
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    apiVersion: 'v1',
  });
};

// Global Self-Healing Error Handler
const globalErrorHandler = (err, req, res, next) => {
  // Capture critical errors in Sentry Monitoring
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  console.error(`❌ [SERVER ERROR] ${req.method} ${req.originalUrl}:`, err.message);

  // Mongoose Bad ObjectId Error
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid resource ID format.',
    });
  }

  // Mongoose Duplicate Key Error (e.g., Duplicate Phone or TrxID)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}) || 'Field';
    return res.status(409).json({
      success: false,
      message: `Duplicate value detected for [${field}]. Record already exists.`,
    });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', '),
    });
  }

  // CORS Security Error
  if (err.message && err.message.startsWith('CORS Policy Blocked')) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server fault handled safely. System self-healing active.'
        : err.message || 'Internal Server Error',
    ...(process.env.DEV_MODE === 'true' && { stack: err.stack }),
  });
};

module.exports = { notFoundHandler, globalErrorHandler };
