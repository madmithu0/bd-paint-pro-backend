const NodeClam = require('clamscan');
const { Readable } = require('stream');
const HackLog = require('../models/HackLog');

let clamScanInstance = null;

// Initialize ClamAV Daemon Connection Lazily
const getClamScanner = async () => {
  if (clamScanInstance) return clamScanInstance;
  try {
    clamScanInstance = await new NodeClam().init({
      removeInfected: true,
      quarantineInfected: false,
      scanLog: null,
      debugMode: false,
      clamdscan: {
        socket: process.env.CLAMAV_SOCKET_PATH || '/var/run/clamav/clamd.ctl',
        host: process.env.CLAMAV_HOST || '127.0.0.1',
        port: Number(process.env.CLAMAV_PORT) || 3310,
        timeout: 15000,
        localFallback: true,
      },
      preference: 'clamdscan',
    });
    return clamScanInstance;
  } catch (err) {
    console.warn('⚠️ [CLAMAV WARNING] Daemon not reachable, running signature fallback:', err.message);
    return null;
  }
};

// Real-Time Antivirus Stream Scan Middleware
const scanUploadedFile = async (req, res, next) => {
  try {
    const filesToScan = [];
    if (req.file) filesToScan.push(req.file);
    if (req.files && Array.isArray(req.files)) filesToScan.push(...req.files);

    if (filesToScan.length === 0) {
      return next();
    }

    const clamscan = await getClamScanner();

    for (const file of filesToScan) {
      if (!file.buffer) continue;

      // 1. Instant EICAR & Embedded Script Signature Check (Zero-Latency Defense)
      const contentSample = file.buffer.toString('utf8', 0, Math.min(file.buffer.length, 4096));
      if (
        contentSample.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') ||
        /<script[\s\S]*?>[\s\S]*?<\/script>/i.test(contentSample) ||
        contentSample.includes('<?php')
      ) {
        await HackLog.create({
          hackIp: req.clientIp || req.ip,
          cloudflareRayId: req.cfRay || 'N/A',
          device: req.headers['user-agent'] || 'Unknown',
          attackType: 'VirusUpload',
          endpoint: req.originalUrl,
          payloadSnippet: `Malicious payload detected in file: ${file.originalname}`,
          action: 'QUARANTINED_AND_DELETED',
        });

        return res.status(400).json({
          success: false,
          message: 'Security Alert: Malicious file or embedded script blocked and quarantined.',
        });
      }

      // 2. ClamAV Antivirus Stream Scan
      if (clamscan) {
        const bufferStream = Readable.from(file.buffer);
        const { isInfected, viruses } = await clamscan.scanStream(bufferStream);

        if (isInfected) {
          await HackLog.create({
            hackIp: req.clientIp || req.ip,
            cloudflareRayId: req.cfRay || 'N/A',
            device: req.headers['user-agent'] || 'Unknown',
            attackType: 'VirusUpload',
            endpoint: req.originalUrl,
            payloadSnippet: `ClamAV Detected: ${(viruses || []).join(', ')} in ${file.originalname}`,
            action: 'INFECTED_FILE_DESTROYED',
          });

          return res.status(400).json({
            success: false,
            message: 'Antivirus Alert: Infected file detected, blocked, and destroyed.',
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('[VIRUS MIDDLEWARE ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'File security verification failed. Upload aborted.',
    });
  }
};

module.exports = { scanUploadedFile };
