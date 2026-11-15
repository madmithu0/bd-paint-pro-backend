const axios = require('axios');
const HackLog = require('../models/HackLog');

const SUSPICIOUS_PATTERNS = [
  /\$where/i,
  /\$ne/i,
  /\$gt/i,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/i,
  /union\s+select/i,
];

// Auto-Ban Malicious IP via Cloudflare WAF API & Record in HackLog
const banIpAuto = async (ipAddress, reason = 'Malicious Activity Detected', cfRay = 'N/A') => {
  try {
    if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1') {
      return { banned: false, reason: 'Localhost IP skipped' };
    }

    // 1. Log attack in MongoDB HackLog
    await HackLog.create({
      hackIp: ipAddress,
      cloudflareRayId: cfRay,
      attackType: 'SuperAdminProbe',
      payloadSnippet: reason,
      action: 'CLOUDFLARE_WAF_AUTO_BAN',
      autoBlocked: true,
    });

    // 2. Call Cloudflare WAF Access Rules API if credentials exist
    if (process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_API_TOKEN) {
      await axios.post(
        `https://cloudflare.com{process.env.CLOUDFLARE_ZONE_ID}/firewall/access_rules/rules`,
        {
          mode: 'block',
          configuration: { target: 'ip', value: ipAddress },
          notes: `Auto-banned by v3.0.0 Self-Healing WAF: ${reason}`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        }
      );
    }

    console.warn(`🚫 [WAF AUTO-BAN] IP ${ipAddress} permanently blocked. Reason: ${reason}`);
    return { banned: true, ipAddress, reason };
  } catch (error) {
    console.error('[WAF BAN ERROR]:', error.message);
    return { banned: false, error: error.message };
  }
};

// Inspect Payload for XSS / NoSQL Injection
const detectSuspiciousPayload = (payloadObj) => {
  const serialized = JSON.stringify(payloadObj || {});
  return SUSPICIOUS_PATTERNS.some((regex) => regex.test(serialized));
};

module.exports = {
  banIpAuto,
  detectSuspiciousPayload,
};
