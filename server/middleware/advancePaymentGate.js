const Job = require('../models/Job');

const isAdvanceVerified = (job) => {
  if (!job) return false;
  return Boolean(
    job.milestone1Paid === true ||
      (job.milestoneStages && job.milestoneStages.stage1Paid === true)
  );
};

const enforceAdvancePaymentGate = async (req, res, next) => {
  try {
    if (req.user && (req.user.role === 'SuperAdmin' || req.user.role === 'Admin')) {
      return next();
    }

    const jobId =
      req.params.jobId || req.params.id || req.body.jobId || req.query.jobId || null;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        locked: true,
        message: 'Valid jobId is required to access chat or contact details.',
      });
    }

    const job = await Job.findById(jobId)
      .select('customer customerId assignedMistri customerSelectedMistris milestone1Paid milestoneStages status')
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        locked: true,
        message: 'Job record not found.',
      });
    }

    const userId = String(req.user.id || req.user._id);
    const isCustomer =
      String(job.customer || '') === userId || String(job.customerId || '') === userId;

    const assignedList = Array.isArray(job.assignedMistri) ? job.assignedMistri : [];
    const selectedList = Array.isArray(job.customerSelectedMistris)
      ? job.customerSelectedMistris.map((m) => m.mistriId || m)
      : [];

    const isAssignedMistri = [...assignedList, ...selectedList].some(
      (id) => String(id) === userId
    );

    if (!isCustomer && !isAssignedMistri) {
      return res.status(403).json({
        success: false,
        locked: true,
        message: 'Unauthorized access to this job communication channel.',
      });
    }

    if (!isAdvanceVerified(job)) {
      return res.status(402).json({
        success: false,
        locked: true,
        code: 'ADVANCE_30_REQUIRED',
        message: '30% advance payment is required before unlocking Mistri phone number and chatbox.',
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
  const sanitized = typeof mistriObj.toObject === 'function' ? mistriObj.toObject() : { ...mistriObj };
  if (!isAdvancePaid) {
    sanitized.phone = null;
    sanitized.contactLocked = true;
  } else {
    sanitized.contactLocked = false;
  }
  return sanitized;
};

const maskMistriPhoneMiddleware = async (req, res, next) => {
  try {
    const jobId = req.params.id || req.params.jobId;
    if (jobId) {
      const job = await Job.findById(jobId)
        .select('milestone1Paid milestoneStages')
        .lean()
        .catch(() => null);
      req.isAdvancePaid =
        req.user?.role === 'SuperAdmin' || req.user?.role === 'Admin' || isAdvanceVerified(job);
    }
    return next();
  } catch (error) {
    return next();
  }
};

module.exports = {
  enforceAdvancePaymentGate,
  maskMistriContactIfUnpaid,
  maskMistriPhoneMiddleware,
};
