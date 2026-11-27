const fs = require('fs');
const path = require('path');
const Job = require('../models/Job');
const AuditLog = require('../models/AuditLog');

const RETENTION_DAYS_AFTER_COMPLETION = 30;
const UPLOAD_ROOT_DIR = path.resolve(__dirname, '../../uploads');

const removeLocalFileSafely = (fileUrl) => {
  try {
    if (!fileUrl || typeof fileUrl !== 'string') return false;
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return false;
    }

    const cleanRelative = fileUrl.replace(/^\/+/, '');
    const absolutePath = path.resolve(__dirname, '../../', cleanRelative);

    if (!absolutePath.startsWith(UPLOAD_ROOT_DIR)) {
      return false;
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
};

const cleanupCompletedJobMedia = async (retentionDays = RETENTION_DAYS_AFTER_COMPLETION) => {
  const cutoffDate = new Date(Date.now() - Number(retentionDays) * 24 * 60 * 60 * 1000);

  const expiredJobs = await Job.find({
    status: { $in: ['Completed', 'Cancelled'] },
    updatedAt: { $lt: cutoffDate },
    mediaCleanedUp: { $ne: true },
  }).limit(100);

  let cleanedJobsCount = 0;
  let deletedFilesCount = 0;

  for (const job of expiredJobs) {
    const mediaList = [
      ...(Array.isArray(job.wallPhotos) ? job.wallPhotos : []),
      ...(Array.isArray(job.wallVideos) ? job.wallVideos : []),
      ...(Array.isArray(job.voiceNotes) ? job.voiceNotes : []),
      ...(Array.isArray(job.mediaUrls) ? job.mediaUrls : []),
    ];

    for (const url of mediaList) {
      if (removeLocalFileSafely(url)) {
        deletedFilesCount += 1;
      }
    }

    job.wallPhotos = [];
    job.wallVideos = [];
    job.voiceNotes = [];
    job.mediaUrls = [];
    job.mediaCleanedUp = true;
    await job.save();
    cleanedJobsCount += 1;
  }

  if (cleanedJobsCount > 0) {
    await AuditLog.create({
      user: 'SYSTEM_CRON',
      role: 'System',
      action: 'EXPIRED_JOB_MEDIA_PURGED',
      category: 'STORAGE',
      details: { cleanedJobsCount, deletedFilesCount, retentionDays },
    }).catch(() => {});
  }

  return {
    success: true,
    cleanedJobsCount,
    deletedFilesCount,
  };
};

module.exports = {
  RETENTION_DAYS_AFTER_COMPLETION,
  removeLocalFileSafely,
  cleanupCompletedJobMedia,
};
