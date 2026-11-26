const PDFDocument = require('pdfkit');
const OTP = require('../models/OTP');
const Job = require('../models/Job');

const maskPhone = (phone) => {
  const str = String(phone || '');
  if (str.length < 7) return 'MASKED';
  return `${str.slice(0, 3)}XXXXX${str.slice(-3)}`;
};

const generateContractData = async (jobId) => {
  const job = await Job.findById(jobId)
    .populate('customer', 'name phone')
    .populate('assignedMistri', 'name phone')
    .lean();

  if (!job) {
    throw new Error('Job not found for contract generation.');
  }

  const isUnlocked = Boolean(job.milestone1Paid || job.milestoneStages?.stage1Paid);
  const warrantyYears = job.price >= 50000 ? 3 : job.price >= 20000 ? 2 : 1;

  return {
    contractId: `CNT-${job._id.toString().slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    versionLock: 'v3.8.0-ENTERPRISE-LEGAL-COMPLIANT',
    createdAt: new Date().toISOString(),
    customer: {
      name: job.customer?.name || 'Customer',
      phone: job.customer?.phone || 'N/A',
    },
    mistris: (job.assignedMistri || []).map((m) => ({
      name: m.name,
      phone: isUnlocked ? m.phone : maskPhone(m.phone),
    })),
    scopeOfWork: {
      totalSqft: job.sqft,
      totalSlots: job.totalSlots || 0,
      estimatedDays: job.totalDays,
      isMistriOnly: job.isMistriOnly,
      wallProblemsAddressed: job.wallProblem,
      selectedServices: job.selectedServices || [],
    },
    financialTerms: {
      totalPriceBdt: job.price,
      milestoneSchedule: '30% Advance / 40% Mid-Work / 30% Completion',
      escrowProtected: true,
      refundPolicy: 'Full refund if cancelled before work starts; pro-rata deduction after work begins.',
    },
    warrantyTerms: {
      validityYears: warrantyYears,
      coverage: `${warrantyYears}-Year Service Warranty against peeling, flaking, and workmanship defects (excludes structural seepage).`,
    },
    mistriLiabilityClauses: {
      antiPoaching:
        'STRICT ANTI-POACHING: Mistri is legally prohibited from soliciting or accepting direct off-platform work or cash payments from the Customer for 12 months. Violation triggers immediate account ban and legal recovery action.',
      antiTheftAndMisconduct:
        'ANTI-THEFT & CONDUCT: Mistri bears full civil and criminal liability for any theft, intentional property damage, or severe misconduct at the Customer premises.',
    },
    safetyAndLiabilityClause:
      'All workers must follow standard scaffolding & safety gear rules. Platform acts as escrow & service facilitator.',
  };
};

const generateMerchantContractData = ({ merchantName, merchantPhone, commissionRate = 4 }) => {
  return {
    contractId: `MCH-${Date.now().toString().slice(-6)}`,
    versionLock: 'v3.8.0-MERCHANT-AGREEMENT',
    merchantName,
    merchantPhone,
    commissionTerms: `Merchant agrees to a ${commissionRate}% platform commission plus agreed dealer margin on all direct and job-routed material orders.`,
    settlementPolicy: 'Automated escrow settlement to verified Merchant wallet upon customer OTP material memo approval.',
    createdAt: new Date().toISOString(),
  };
};
const generateContractPdfBuffer = async (jobId) => {
  const contract = await generateContractData(jobId);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text('CUSTOMER - MISTRI DIGITAL WORK CONTRACT', { align: 'center' });
      doc.fontSize(9).text(`Contract ID: ${contract.contractId} | ${contract.versionLock}`, { align: 'center' });
      doc.moveDown(1.2);

      doc.fontSize(11).text(`Customer: ${contract.customer.name} (${contract.customer.phone})`);
      doc.text(`Total Area: ${contract.scopeOfWork.totalSqft} Sqft | Duration: ${contract.scopeOfWork.estimatedDays} Days`);
      doc.text(`Total Value: BDT ${contract.financialTerms.totalPriceBdt} (${contract.financialTerms.milestoneSchedule})`);
      doc.moveDown(0.8);

      doc.fontSize(10).text('1. Warranty Terms:', { underline: true });
      doc.text(contract.warrantyTerms.coverage);
      doc.moveDown(0.5);

      doc.text('2. Anti-Poaching & Legal Liability:', { underline: true });
      doc.text(contract.mistriLiabilityClauses.antiPoaching);
      doc.text(contract.mistriLiabilityClauses.antiTheftAndMisconduct);
      doc.moveDown(0.5);

      doc.text('3. Refund & Site Safety Policy:', { underline: true });
      doc.text(`${contract.financialTerms.refundPolicy} ${contract.safetyAndLiabilityClause}`);
      doc.moveDown(1.5);

      doc.text('Digitally Verified via OTP Signature System.', { align: 'center' });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

const signContractWithOtp = async ({ phone, otpCode, jobId, purpose = 'CONTRACT_SIGN' }) => {
  const validOtp = await OTP.findOne({
    phone: String(phone).trim(),
    code: String(otpCode).trim(),
    purpose: { $in: [purpose, 'CONTRACT_SIGN', 'ADDON_CONTRACT'] },
    verified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!validOtp) {
    return { signed: false, message: 'Invalid or expired Contract Signing OTP.' };
  }

  validOtp.verified = true;
  await validOtp.save();

  return {
    signed: true,
    jobId,
    signedByPhone: phone,
    signedAt: new Date().toISOString(),
    legalStatus: 'BINDING_DIGITAL_SIGNATURE',
  };
};

module.exports = {
  generateContractData,
  generateMerchantContractData,
  generateContractPdfBuffer,
  signContractWithOtp,
};
