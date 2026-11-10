const Payment = require('../models/Payment');
const Job = require('../models/Job');

async function create(req, res) {
  try {
    const { jobId, amount, method } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (String(job.customer) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not your job' });
    }
    if (Number(amount) !== Number(job.price)) {
      return res.status(400).json({ success: false, message: 'Amount must match job price' });
    }
    const payment = await Payment.create({
      job: jobId,
      user: req.user._id,
      amount: Number(amount),
      method,
      status: 'pending',
      escrow: true
    });
    res.status(201).json({ success: true, data: payment });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function list(req, res) {
  try {
    const list = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function details(req, res) {
  try {
    const p = await Payment.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Not found' });
    if (String(p.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.json({ success: true, data: p });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function verify(req, res) {
  try {
    const { trxId, amount } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Not found' });
    if (payment.status === 'paid') return res.status(409).json({ success: false, message: 'Already verified' });
    const dup = await Payment.findOne({ trxId: String(trxId).trim(), status: 'paid' });
    if (dup) return res.status(409).json({ success: false, message: 'Duplicate trxId' });
    if (amount !== undefined && Number(amount) !== Number(payment.amount)) {
      return res.status(400).json({ success: false, message: 'Amount mismatch' });
    }
    payment.trxId = String(trxId).trim();
    payment.status = 'paid';
    payment.escrow = true;
    await payment.save();
    res.json({ success: true, data: payment });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ success: false, message: 'Duplicate trxId' });
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { create, list, details, verify };