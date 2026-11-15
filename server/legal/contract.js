const PDFDocument = require('pdfkit');
const OTP = require('../models/OTP');
const Job = require('../models/Job');

const generateContractData = async (jobId) => {
  const job = await Job.findById(jobId)
    .populate('customer', 'name phone')
    .populate('assignedMistri', 'name phone')
    .lean();

  if (!job) {
    throw new Error('Job not found for contract generation.');
  }

  return {
    contractId: `CNT-${job._id.toString().slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    versionLock: 'v3.0.0-BD-LABOR-COMPLIANT',
    createdAt: new Date().toISOString(),
    customer: {
      name: job.customer?.name || 'Customer',
      phone: job.customer?.phone || 'N/A',
    },
    mistris: (job.assignedMistri || []).map((m) => ({ name: m.name, phone: m.phone })),
    scopeOfWork: {
      totalSqft: job.sqft,
      estimatedDays: job.totalDays,
      perDayStandard: '450 Sqft/Day',
      isMistriOnly: job.isMistriOnly,
      wallProblemsAddressed: job.wallProblem,
    },
    financialTerms: {
      totalPriceBdt: job.price,
      escrowProtected: true,
      refundPolicy: 'Full refund if cancelled before work starts; pro-rata deduction after work begins.',
    },
    safetyAndLiabilityClause:
      'All workers must follow standard scaffolding & safety gear rules. Platform acts as escrow & service facilitator; site safety compliance is jointly maintained.',
  };
};

// Create Printable Contract PDF Buffer
const generateContractPdfBuffer = async (jobId) => {
  const contract = await generateContractData(jobId);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('CUSTOMER - MISTRI DIGITAL WORK CONTRACT', { align: 'center' });
      doc.fontSize(10).text(`Contract ID: ${contract.contractId} | ${contract.versionLock}`, { align: 'center' });
      doc.moveDown(1.5);

      doc.fontSize(12).text(`Customer: ${contract.customer.name} (${contract.customer.phone})`);
      doc.text(`Total Area: ${contract.scopeOfWork.totalSqft} Sqft | Duration: ${contract.scopeOfWork.estimatedDays} Days`);
      doc.text(`Total Contract Value: BDT ${contract.financialTerms.totalPriceBdt}`);
      doc.moveDown();

      doc.fontSize(11).text('1. Refund & Escrow Policy:', { underline: true });
      doc.text(contract.financialTerms.refundPolicy);
      doc.moveDown(0.5);

      doc.text('2. Accident & Site Safety Liability:', { underline: true });
      doc.text(contract.safetyAndLiabilityClause);
      doc.moveDown(2);

      doc.text('Digitally Verified via OTP Signature System.', { align: 'center' });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// Sign Contract via Phone OTP Verification
const signContractWithOtp = async ({ phone, otpCode, jobId }) => {
  const validOtp = await OTP.findOne({
    phone: String(phone).trim(),
    code: String(otpCode).trim(),
    purpose: 'CONTRACT_SIGN',
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
  generateContractPdfBuffer,
  signContractWithOtp,
};
