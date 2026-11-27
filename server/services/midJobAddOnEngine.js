const crypto = require('crypto');
const Job = require('../models/Job');
const User = require('../models/User');
const ServiceCategory = require('../models/ServiceCategory');
const OTP = require('../models/OTP');
const AuditLog = require('../models/AuditLog');

const safeRequire = (path) => {
  try {
    return require(path);
  } catch (err) {
    return null;
  }
};

const smsUtils = safeRequire('../utils/smsUtils');

const requestAddOnAmendmentOtp = async ({ jobId, addOnSummary }) => {
  const job = await Job.findById(jobId).populate('customerId', 'phone').populate('customer', 'phone');
  if (!job) {
    throw new Error('Job not found for add-on contract amendment.');
  }

  const customerPhone = job.customerId?.phone || job.customer?.phone || job.customerPhone;
  if (!customerPhone) {
    throw new Error('Customer phone number not found for OTP verification.');
  }

  const otpCode = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OTP.deleteMany({ phone: customerPhone, purpose: 'MID_JOB_ADDON_AMENDMENT', verified: false });
  await OTP.create({
    phone: customerPhone,
    code: otpCode,
    purpose: 'MID_JOB_ADDON_AMENDMENT',
    verified: false,
    expiresAt,
  });

  if (smsUtils?.sendSms) {
    await smsUtils.sendSms(
      customerPhone,
      `Mid-Job Add-On Contract Amendment OTP for Job #${String(job._id).slice(-6)} (${addOnSummary}): ${otpCode}`
    ).catch(() => {});
  }

  return {
    otpSent: true,
    customerPhone,
    ...(process.env.DEV_MODE === 'true' && { devOtp: otpCode }),
  };
};

const appendMidJobService = async ({
  jobId,
  userId,
  userRole,
  serviceId,
  serviceName,
  sqft,
  coatCount = 2,
  isMistriOnly = false,
  paintBrand = '',
  otpCode,
  autoAssignSpecialist = true,
}) => {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new Error('Job not found.');
  }

  const validStates = ['Pending', 'Confirmed', 'Assigned', 'In-Progress', 'InProgress'];
  if (!validStates.includes(job.status)) {
    throw new Error(`Cannot add mid-job service when job status is ${job.status}.`);
  }

  const numericSqft = Math.max(1, Number(sqft || 0));
  let slotSqftPerDay = 450;
  let ratePerSqft = isMistriOnly ? 12 : 30;
  let coatMultiplier = coatCount > 1 ? 1 + (coatCount - 1) * 0.4 : 1;
  let resolvedName = serviceName || 'Additional Painting Service';
  let resolvedMaterialCost = 0;

  if (serviceId) {
    const category = await ServiceCategory.findById(serviceId).lean().catch(() => null);
    if (category) {
      resolvedName = category.nameEn || category.name || resolvedName;
      slotSqftPerDay = category.slotSqftPerDay || slotSqftPerDay;
      const coats = Math.max(1, Number(coatCount || category.defaultCoats || 2));
      coatMultiplier = coats > 1 ? 1 + (coats - 1) * (category.perCoatRateMultiplier || 0.4) : 1;

      const baseRate = isMistriOnly ? category.labourRatePerSqft : category.withMaterialRatePerSqft;
      ratePerSqft = Number((baseRate * coatMultiplier).toFixed(2));
      if (!isMistriOnly) {
        resolvedMaterialCost = Math.round(
          numericSqft * (category.withMaterialRatePerSqft - category.labourRatePerSqft) * coatMultiplier
        );
      }
    }
  }
  const calculatedSlots = Number(((numericSqft * coatMultiplier) / Math.max(1, slotSqftPerDay)).toFixed(2));
  const subTotal = Math.round(numericSqft * ratePerSqft);
  const supplementaryAdvance30 = Math.round(subTotal * 0.3);

  if (otpCode) {
    const populatedJob = await Job.findById(jobId)
      .populate('customerId', 'phone')
      .populate('customer', 'phone')
      .lean();
    const customerPhone =
      populatedJob?.customerId?.phone || populatedJob?.customer?.phone || populatedJob?.customerPhone;

    if (customerPhone) {
      const otpRecord = await OTP.findOne({
        phone: customerPhone,
        code: String(otpCode).trim(),
        purpose: 'MID_JOB_ADDON_AMENDMENT',
        verified: false,
        expiresAt: { $gt: new Date() },
      });

      if (!otpRecord) {
        throw new Error('Invalid or expired Mid-Job Add-On OTP.');
      }

      otpRecord.verified = true;
      await otpRecord.save();
    }
  }

  let additionalMistriAssigned = null;
  if (autoAssignSpecialist && calculatedSlots > 2 && serviceId) {
    const existingIds = [
      ...(Array.isArray(job.assignedMistri) ? job.assignedMistri : []),
      ...(Array.isArray(job.customerSelectedMistris)
        ? job.customerSelectedMistris.map((m) => m.mistriId || m)
        : []),
    ];

    const specialist = await User.findOne({
      _id: { $nin: existingIds },
      role: 'Mistri',
      accountStatus: 'Active',
      penaltyStatus: { $ne: 'Suspended' },
      isAvailable: { $ne: false },
      capableServices: serviceId,
      ...(job.district ? { district: job.district } : {}),
    })
      .sort({ qualityScore: -1 })
      .lean()
      .catch(() => null);

    if (specialist) {
      additionalMistriAssigned = { mistriId: specialist._id, mistriName: specialist.name };
      if (Array.isArray(job.assignedMistri)) job.assignedMistri.push(specialist._id);
      if (Array.isArray(job.customerSelectedMistris)) {
        job.customerSelectedMistris.push(additionalMistriAssigned);
      }
    }
  }

  if (!Array.isArray(job.selectedServices)) job.selectedServices = [];
  const addOnEntry = {
    ...(serviceId && { serviceId }),
    serviceName: resolvedName,
    sqft: numericSqft,
    coatCount: Number(coatCount),
    isMistriOnly: Boolean(isMistriOnly),
    paintBrand: String(paintBrand || '').trim(),
    calculatedSlots,
    subTotal,
    addedMidJob: true,
  };

  job.selectedServices.push(addOnEntry);
  job.totalSqft = Number(((job.totalSqft || job.sqft || 0) + numericSqft).toFixed(2));
  job.totalSlots = Number(((job.totalSlots || 0) + calculatedSlots).toFixed(2));
  job.totalBill = Number(((job.totalBill || job.price || 0) + subTotal).toFixed(2));
  job.materialCost = Number(((job.materialCost || 0) + resolvedMaterialCost).toFixed(2));
  job.netProfit = Math.max(0, Number((job.totalBill - job.materialCost).toFixed(2)));

  await job.save();

  await AuditLog.create({
    user: String(userId || 'SYSTEM'),
    role: userRole || 'System',
    action: 'MID_JOB_ADDON_SERVICE_APPENDED',
    category: 'JOB',
    details: { jobId: job._id, serviceName: resolvedName, subTotal, supplementaryAdvance30 },
  }).catch(() => {});

  return {
    jobId: job._id,
    addedService: addOnEntry,
    supplementaryAdvance30,
    additionalMistriAssigned,
    updatedTotals: {
      totalSqft: job.totalSqft,
      totalSlots: job.totalSlots,
      totalBill: job.totalBill,
      materialCost: job.materialCost,
      netProfit: job.netProfit,
    },
  };
};

module.exports = {
  requestAddOnAmendmentOtp,
  appendMidJobService,
  processMidJobAddOn: appendMidJobService,
};
