const User = require('../models/User');
const Review = require('../models/Review');
const Dispute = require('../models/Dispute');
const AuditLog = require('../models/AuditLog');

const WARNING_THRESHOLD = 4.0;
const SUSPENSION_THRESHOLD = 3.2;
const MIN_REVIEWS_FOR_PENALTY = 3;

const evaluateWorkerQuality = async (workerId) => {
  if (!workerId) {
    return null;
  }

  const worker = await User.findById(workerId);
  if (!worker || worker.role !== 'Mistri') {
    return null;
  }

  const [reviews, activeDisputesCount] = await Promise.all([
    Review.find({ mistri: workerId }).select('rating').lean().catch(() => []),
    Dispute.countDocuments({
      accusedUser: workerId,
      status: { $in: ['Open', 'Escalated'] },
    }).catch(() => 0),
  ]);

  let averageRating = Number(worker.qualityScore || 5.0);
  if (reviews.length > 0) {
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 5), 0);
    averageRating = Number((sum / reviews.length).toFixed(2));
  }

  const disputePenalty = Number((activeDisputesCount * 0.25).toFixed(2));
  const effectiveScore = Math.max(1.0, Number((averageRating - disputePenalty).toFixed(2)));

  let penaltyStatus = 'Good';
  let accountStatus = worker.accountStatus || 'Active';

  if (reviews.length >= MIN_REVIEWS_FOR_PENALTY || activeDisputesCount > 0) {
    if (effectiveScore < SUSPENSION_THRESHOLD || activeDisputesCount >= 3) {
      penaltyStatus = 'Suspended';
      accountStatus = 'Suspended';
    } else if (effectiveScore < WARNING_THRESHOLD || activeDisputesCount >= 1) {
      penaltyStatus = 'Warning';
    }
  }

  worker.qualityScore = effectiveScore;
  worker.penaltyStatus = penaltyStatus;
  worker.accountStatus = accountStatus;
  await worker.save();

  if (penaltyStatus !== 'Good') {
    await AuditLog.create({
      user: String(worker._id),
      role: 'Mistri',
      action: `QUALITY_PENALTY_${penaltyStatus.toUpperCase()}`,
      category: 'QUALITY',
      details: {
        averageRating,
        activeDisputesCount,
        effectiveScore,
        penaltyStatus,
      },
    }).catch(() => {});
  }

  return {
    workerId: worker._id,
    averageRating,
    activeDisputesCount,
    qualityScore: effectiveScore,
    penaltyStatus,
    accountStatus,
  };
};

module.exports = {
  WARNING_THRESHOLD,
  SUSPENSION_THRESHOLD,
  evaluateWorkerQuality,
};
