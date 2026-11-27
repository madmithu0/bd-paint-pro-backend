const express = require('express');
const router = express.Router();
const Dispute = require('../models/Dispute');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { requireRole } = require('../middleware/authMiddleware');

const safeRequire = (path) => {
  try {
    return require(path);
  } catch (err) {
    return null;
  }
};

const qualityPenaltyEngine = safeRequire('../services/qualityPenaltyEngine');

const VALID_VIOLATIONS = ['Standard', 'OffPlatformPoaching', 'Theft', 'Misconduct'];
const SEVERE_VIOLATIONS = ['OffPlatformPoaching', 'Theft', 'Misconduct'];

router.post('/', async (req, res, next) => {
  try {
    const {
      jobId,
      accusedUserId,
      reason,
      violationType = 'Standard',
      description,
      evidenceUrls = [],
    } = req.body;

    if (!jobId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Job ID and dispute reason are required.',
      });
    }

    const cleanViolation = VALID_VIOLATIONS.includes(violationType) ? violationType : 'Standard';
    const isSevere = SEVERE_VIOLATIONS.includes(cleanViolation);
    const userId = req.user._id || req.user.id;

    const dispute = await Dispute.create({
      job: jobId,
      raisedBy: userId,
      ...(accusedUserId && { accusedUser: accusedUserId }),
      reason: String(reason).trim(),
      violationType: cleanViolation,
      severity: isSevere ? 'High' : 'Normal',
      legalNoticeIssued: false,
      description: description ? String(description).trim() : '',
      evidenceUrls,
      status: 'Open',
    });

    if (accusedUserId && qualityPenaltyEngine?.evaluateWorkerQuality) {
      await qualityPenaltyEngine.evaluateWorkerQuality(accusedUserId).catch(() => {});
    }

    await AuditLog.create({
      user: String(userId),
      role: req.user.role,
      action: `DISPUTE_FILED_${cleanViolation.toUpperCase()}`,
      category: isSevere ? 'LEGAL' : 'DISPUTE',
      ipAddress: req.ip || '',
      details: { disputeId: dispute._id, jobId, violationType: cleanViolation },
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: isSevere
        ? 'Severe legal violation dispute filed and escalated to compliance team.'
        : 'Dispute filed successfully. Support team will review it shortly.',
      dispute,
    });
  } catch (error) {
    next(error);
  }
});
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const isAdmin = req.user.role === 'SuperAdmin' || req.user.role === 'Admin';
    const filter = isAdmin ? {} : { raisedBy: userId };

    if (req.query.violationType && VALID_VIOLATIONS.includes(req.query.violationType)) {
      filter.violationType = req.query.violationType;
    }

    const disputes = await Dispute.find(filter)
      .populate('job', 'totalSqft sqft totalBill status')
      .populate('raisedBy', 'name phone role')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: disputes.length,
      disputes,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/escalate-legal', requireRole(['SuperAdmin', 'Admin']), async (req, res, next) => {
  try {
    const { violationType, legalNoticeSummary, suspendAccused = true, fineAmount = 0 } = req.body;
    const dispute = await Dispute.findById(req.params.id);

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found.' });
    }

    if (violationType && VALID_VIOLATIONS.includes(violationType)) {
      dispute.violationType = violationType;
    }
    dispute.severity = 'Critical';
    dispute.legalNoticeIssued = true;
    dispute.status = 'Escalated';
    if (legalNoticeSummary) {
      dispute.solutionNote = String(legalNoticeSummary).trim();
    }
    await dispute.save();

    if (suspendAccused && dispute.accusedUser) {
      await User.findByIdAndUpdate(dispute.accusedUser, {
        $set: { accountStatus: 'Suspended', penaltyStatus: 'Suspended' },
      }).catch(() => {});
    }

    await AuditLog.create({
      user: String(req.user._id || req.user.id),
      role: req.user.role,
      action: 'DISPUTE_LEGAL_ESCALATION_ISSUED',
      category: 'LEGAL',
      ipAddress: req.ip || '',
      details: {
        disputeId: dispute._id,
        violationType: dispute.violationType,
        accusedUser: dispute.accusedUser || null,
        fineAmount: Number(fineAmount),
      },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Legal violation notice issued and account action enforced.',
      dispute,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/solve', requireRole(['SuperAdmin', 'Admin', 'Agent']), async (req, res, next) => {
  try {
    const { solutionNote, status = 'Solved' } = req.body;

    const dispute = await Dispute.findByIdAndUpdate(
      req.params.id,
      {
        status,
        solutionNote: solutionNote || 'Resolved by authority',
        solvedBy: req.user._id || req.user.id,
        solvedAt: new Date(),
      },
      { new: true }
    );

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Dispute marked as solved.',
      dispute,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
