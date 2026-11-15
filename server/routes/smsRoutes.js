const express = require('express');
const router = express.Router();
const SmsLog = require('../models/SmsLog');
const { requireRole } = require('../middleware/authMiddleware');
const { sendSmsQueue } = require('../utils/smsUtils');

// In-memory / DB backed SMS templates registry
const smsTemplates = [
  { id: 'TPL_OTP', name: 'OTP Verification', body: 'Your verification code is {{code}}. Valid for 5 minutes.' },
  { id: 'TPL_JOB_START', name: 'Job Start Alert', body: 'Your paint job #{{jobId}} has started. Start OTP: {{otp}}' },
  { id: 'TPL_PAY_SUCCESS', name: 'Payment Confirmation', body: 'Received BDT {{amount}} for Job #{{jobId}}. TrxID: {{trxId}}' },
];

// @route   POST /api/v1/sms
// @desc    Send SMS via BullMQ Retry Queue
// @access  Protected (SuperAdmin / Agent)
router.post('/', requireRole(['SuperAdmin', 'Agent']), async (req, res, next) => {
  try {
    const { to, text, templateId } = req.body;

    if (!to || !text) {
      return res.status(400).json({
        success: false,
        message: 'Recipient phone number and SMS text are required.',
      });
    }

    const queuedJob = await sendSmsQueue({
      to: String(to).trim(),
      text: String(text).trim(),
      templateId: templateId || null,
      sentBy: req.user.id,
    });

    res.status(202).json({
      success: true,
      message: 'SMS queued for delivery via BullMQ.',
      jobId: queuedJob?.id || `SMS-${Date.now()}`,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/sms
// @desc    Get SMS Log List
// @access  Protected (SuperAdmin)
router.get('/', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const logs = await SmsLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.status(200).json({ success: true, count: logs.length, logs });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/v1/sms/templates
// @desc    Get SMS Template List
// @access  Protected (SuperAdmin / Agent)
router.get('/templates', requireRole(['SuperAdmin', 'Agent']), (req, res) => {
  res.status(200).json({ success: true, templates: smsTemplates });
});

// @route   POST /api/v1/sms/templates
// @desc    Create a New SMS Template
// @access  Protected (SuperAdmin)
router.post('/templates', requireRole(['SuperAdmin']), (req, res) => {
  const { name, body } = req.body;
  if (!name || !body) {
    return res.status(400).json({ success: false, message: 'Template name and body are required.' });
  }

  const newTemplate = {
    id: `TPL_${Date.now()}`,
    name: String(name).trim(),
    body: String(body).trim(),
  };
  smsTemplates.push(newTemplate);

  res.status(201).json({ success: true, template: newTemplate });
});

// @route   GET /api/v1/sms/:id
// @desc    Get Single SMS Log Details
// @access  Protected (SuperAdmin)
router.get('/:id', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const sms = await SmsLog.findById(req.params.id).lean();
    if (!sms) return res.status(404).json({ success: false, message: 'SMS record not found.' });
    res.status(200).json({ success: true, sms });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/v1/sms/:id
// @desc    Delete an SMS Log Record
// @access  Protected (SuperAdmin)
router.delete('/:id', requireRole(['SuperAdmin']), async (req, res, next) => {
  try {
    const deleted = await SmsLog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'SMS record not found.' });
    res.status(200).json({ success: true, message: 'SMS log deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
