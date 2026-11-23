const Job = require('../models/Job');

const enforceAdvancePaymentGate = async (req, res, next) => {
  try {
    if (req.user && req.user.role === 'SuperAdmin') {
      return next();
    }

    const jobId =
      req.params.jobId || req.body.jobId || req.query.jobId || null;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        locked: true,
        message: 'Valid jobId is required to access chat or contact details',
      });
    }

    const job = await Job.findById(jobId)
      .select('customerId assignedMistriIds milestoneStages status')
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        locked: true,
        message: 'Job record not found',
      });
    }

    const userId = String(req.user._id);
    const isCustomer = String(job.customerId) === userId;
    const isAssignedMistri = Array.isArray(job.assignedMistriIds)
      ? job.assignedMistriIds.some((id) => String(id) === userId)
      : false;

    if (!isCustomer && !isAssignedMistri) {
      return res.status(403).json({
        success: false,
        locked: true,
        message: 'Unauthorized access to this job communication channel',
      });
    }

    const isMilestone1Paid = Boolean(
      job.milestoneStages && job.milestoneStages.stage1Paid === true
    );

    if (!isMilestone1Paid) {
      return res.status(402).json({
        success: false,
        locked: true,
        code: 'ADVANCE_30_REQUIRED',
        message:
          '30% advance payment is required before unlocking Mistri phone number and chatbox',
      });
    }

    req.verifiedJob = job;
    return next();
  } catch (error) {
    next(error);
  }
};

const maskMistriContactIfUnpaid = (mistriObj, isAdvancePaid) => {
  if (!mistriObj) return null;
  const sanitized = { ...mistriObj };
  if (!isAdvancePaid) {
    sanitized.phone = null;
    sanitized.contactLocked = true;
  } else {
    sanitized.contactLocked = false;
  }
  return sanitized;
};

module.exports = {
  enforceAdvancePaymentGate,
  maskMistriContactIfUnpaid,
};
