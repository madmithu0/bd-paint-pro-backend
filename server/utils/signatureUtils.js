const crypto = require('crypto');
const HackLog = require('../models/HackLog');

const createHmacSignature = (payload) => {
  const secret = process.env.HMAC_WEBHOOK_SECRET || 'default_dev_hmac_secret_2026';
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return crypto.createHmac('sha256', secret).update(serialized).digest('hex');
};

// Express Middleware to Verify Webhook HMAC-SHA256 Signature
const verifyHmacSignature = async (req, res, next) => {
  try {
    // Allow sandbox testing if DEV_MODE is explicitly enabled
    if (process.env.DEV_MODE === 'true' && !req.headers['x-signature']) {
      return next();
    }

    const receivedSig = req.headers['x-signature'] || req.headers['x-hub-signature-256'];
    if (!receivedSig) {
      return res.status(401).json({
        success: false,
        message: 'Missing webhook cryptographic signature.',
      });
    }

    const expectedSig = createHmacSignature(req.body);
    const sigBuffer = Buffer.from(String(receivedSig), 'utf8');
    const expectedBuffer = Buffer.from(expectedSig, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      await HackLog.create({
        hackIp: req.clientIp || req.ip,
        cloudflareRayId: req.cfRay || 'N/A',
        attackType: 'InvalidSignature',
        endpoint: req.originalUrl,
        payloadSnippet: 'Forged Webhook Signature Blocked',
        action: 'WEBHOOK_REJECTED',
      });

      return res.status(403).json({
        success: false,
        message: 'Invalid HMAC-SHA256 signature. Request rejected.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createHmacSignature,
  verifyHmacSignature,
};
