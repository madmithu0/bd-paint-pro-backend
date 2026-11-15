const { Queue } = require('bullmq');
const Redis = require('ioredis');

const customBackoffStrategy = (attemptsMade) => {
  // Retry intervals: 5 seconds, 30 seconds, 2 minutes (120 seconds)
  const delays =;
  return delays[attemptsMade - 1] || 120000;
};

let connection = null;
if (process.env.REDIS_URL) {
  connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

const createEnterpriseQueue = (queueName) => {
  if (!connection) return null;
  return new Queue(queueName, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'custom' },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });
};

const queues = {
  smsQueue: createEnterpriseQueue('enterprise-sms-queue'),
  emailQueue: createEnterpriseQueue('enterprise-email-queue'),
  paymentVerifyQueue: createEnterpriseQueue('enterprise-payment-queue'),
  backupSyncQueue: createEnterpriseQueue('enterprise-backup-queue'),
};

const enqueueTask = async (queueType, jobName, payload) => {
  const targetQueue = queues[queueType];
  if (!targetQueue) {
    return { queued: false, fallbackDirect: true, payload };
  }
  const job = await targetQueue.add(jobName, payload, {
    backoff: { type: 'custom' },
  });
  return { queued: true, jobId: job.id };
};

module.exports = {
  queues,
  enqueueTask,
  customBackoffStrategy,
};
