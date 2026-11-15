const axios = require('axios');

const cdnSecurityConfig = {
  provider: 'Cloudflare Enterprise WAF & CDN',
  ddosMitigation: 'UnderAttack / High Sensitivity Ready',
  staticCacheTtlSeconds: 86400 * 30, // 30 days CDN edge cache for static assets
  signedUrlExpirySeconds: 3600,
};

// Purge Cloudflare CDN Cache when new version deploys
const purgeCloudflareCache = async () => {
  if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_TOKEN) {
    return { purged: false, reason: 'Cloudflare credentials not set' };
  }

  const res = await axios.post(
    `https://cloudflare.com{process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
    { purge_everything: true },
    {
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    }
  );
  return { purged: res.data?.success === true };
};

// Uptime Heartbeat Ping
const reportHeartbeat = async () => {
  if (process.env.UPTIME_HEARTBEAT_URL) {
    await axios.get(process.env.UPTIME_HEARTBEAT_URL, { timeout: 5000 }).catch(() => {});
  }
};

module.exports = {
  cdnSecurityConfig,
  purgeCloudflareCache,
  reportHeartbeat,
};
