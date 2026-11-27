const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Job = require('../models/Job');
const Kill = require('../models/Kill');

const safeRequire = (path) => {
  try {
    return require(path);
  } catch (err) {
    return null;
  }
};

const pdfUtils = safeRequire('../utils/pdfUtils');
const govtUtils = safeRequire('../utils/govtUtils');

router.post('/', async (req, res, next) => {
  try {
    const { jobId, amount, pdfUrl, vatRatePercent = 7.5 } = req.body;
    const job = await Job.findById(jobId).lean();

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const initialServices = [];
    const midJobAddOnSchedule = [];

    if (Array.isArray(job.selectedServices)) {
      job.selectedServices.forEach((srv) => {
        const entry = {
          serviceId: srv.serviceId,
          serviceName: srv.serviceName || 'Painting Service',
          sqft: Number(srv.sqft || 0),
          coatCount: Number(srv.coatCount || 2),
          isMistriOnly: Boolean(srv.isMistriOnly),
          paintBrand: srv.paintBrand || '',
          calculatedSlots: Number(srv.calculatedSlots || 0),
          subTotal: Number(srv.subTotal || 0),
        };
        if (srv.addedMidJob) {
          midJobAddOnSchedule.push(entry);
        } else {
          initialServices.push(entry);
        }
      });
    }

    const totalBill = Number(amount) || Number(job.totalBill || job.price || 0);
    const materialCost = job.isMistriOnly ? 0 : Number(job.materialCost || 0);
    const netProfit = Math.max(0, Number((totalBill - materialCost).toFixed(2)));

    const govtKill = await Kill.findOne({ target: 'GOVT_COMPLIANCE_FLAGS' }).lean().catch(() => null);
    const isAutoVatEnabled = Boolean(govtKill?.govtFeatureFlags?.autoVatEnabled);

    let optionalVatAmount = 0;
    if (isAutoVatEnabled) {
      if (govtUtils?.calculateConditionalVat) {
        optionalVatAmount = Number(govtUtils.calculateConditionalVat(totalBill, true, vatRatePercent));
      } else {
        optionalVatAmount = Number(((totalBill * Number(vatRatePercent)) / 100).toFixed(2));
      }
    }

    const grandTotalWithVat = Number((totalBill + optionalVatAmount).toFixed(2));
    const hasAgent = Boolean(job.agentLeadId || job.agent);

    const shareBreakup = {
      mistriShare: Number((netProfit * 0.80).toFixed(2)),
      agentShare: hasAgent ? Number((netProfit * 0.05).toFixed(2)) : 0,
      platformShare: hasAgent
        ? Number((netProfit * 0.15).toFixed(2))
        : Number((netProfit * 0.20).toFixed(2)),
      isMistriOnly: Boolean(job.isMistriOnly),
    };
    let generatedPdfUrl = pdfUrl || '';
    if (!generatedPdfUrl && pdfUtils?.generateInvoicePdf) {
      const pdfRes = await pdfUtils.generateInvoicePdf({
        job,
        initialServices,
        midJobAddOnSchedule,
        totalBill,
        materialCost,
        optionalVatAmount,
        netProfit,
        shareBreakup,
      }).catch(() => null);
      if (pdfRes?.url) generatedPdfUrl = pdfRes.url;
    }

    const invoice = await Invoice.create({
      job: job._id,
      user: req.user._id || req.user.id,
      invoiceNumber: `INV-${Date.now()}`,
      initialServices,
      midJobAddOnSchedule,
      totalBill,
      amount: grandTotalWithVat,
      materialCost,
      materialMemoApproved: Boolean(job.materialMemoApproved),
      optionalVatAmount,
      vatApplied: isAutoVatEnabled,
      netProfit,
      warrantyRef: job.warrantyId || null,
      pdfUrl: generatedPdfUrl,
      shareBreakup,
    });

    return res.status(201).json({
      success: true,
      invoice,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const filter = req.user.role === 'SuperAdmin' ? {} : { user: userId };
    const invoices = await Invoice.find(filter)
      .populate('job', 'totalSqft sqft status isMistriOnly selectedServices')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('job').lean();
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    return res.status(200).json({
      success: true,
      downloadReady: true,
      invoice,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
