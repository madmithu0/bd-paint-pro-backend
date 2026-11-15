const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/authMiddleware');
const { triggerManualCloudBackup, listS3Backups, restoreFromPitrTimestamp } = require('../utils/backupUtils');

// @route   POST /api/v1/backup/create
// @desc    Trigger Immediate Encrypted Cloud Snapshot to AWS S3 / Cloudflare R2
// @access  Protected (SuperAdmin)
router.post('/create', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { backupType = 'INCREMENTAL' } = req.body; // 'INCREMENTAL' or 'FULL'
    const result = await triggerManualCloudBackup(backupType);

    res.status(201).json({
      success: true,
      message: `${backupType} cloud backup completed and synced to S3/R2.`,
      backup: result,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/backup/list
// @desc    Get S3/R2 Cloud Backup Snapshots & Change Stream Sync Status
// @access  Protected (SuperAdmin)
router.get('/list', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const snapshots = await listS3Backups();
    res.status(200).json({
      success: true,
      schedule: {
        incrementalInterval: 'Every 10 Minutes',
        fullBackupFrequency: 'Twice Daily (Every 12 Hours)',
        cdcChangeStream: 'Active',
      },
      snapshots,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/v1/backup/pitr-restore
// @desc    Restore Database to Exact Point-in-Time Recovery (PITR) Timestamp
// @access  Protected (SuperAdmin)
router.post('/pitr-restore', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const { targetTimestamp } = req.body;
    if (!targetTimestamp) {
      return res.status(400).json({
        success: false,
        message: 'Exact ISO timestamp is required for PITR restore.',
      });
    }

    const restoreResult = await restoreFromPitrTimestamp(targetTimestamp, req.user.id);
    res.status(200).json({
      success: true,
      message: `Point-in-Time Recovery initiated for timestamp: ${targetTimestamp}`,
      restoreResult,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
