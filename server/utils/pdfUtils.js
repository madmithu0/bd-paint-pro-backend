const PDFDocument = require('pdfkit');

const generateInvoicePdfBuffer = ({
  invoiceNumber,
  customerName,
  jobSqft,
  totalAmount,
  isMistriOnly = false,
  shareBreakup = {},
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('ENTERPRISE PAINT & WALL CARE (BD)', { align: 'center' });
      doc.fontSize(10).text('Version Lock: v3.0.0 | Official Tax & Service Invoice', { align: 'center' });
      doc.moveDown(1.5);

      // Invoice Meta
      doc.fontSize(12).text(`Invoice Number: ${invoiceNumber}`);
      doc.text(`Date: ${new Date().toLocaleDateString('en-BD')}`);
      doc.text(`Customer: ${customerName || 'Valued Client'}`);
      doc.text(`Service Mode: ${isMistriOnly ? 'Mistri-Only (Customer Own Paint)' : 'Full Material + Labour'}`);
      doc.moveDown();

      // Work Details
      doc.text(`Total Wall Area: ${jobSqft} Sqft`);
      doc.text(`Estimated Work Days (450 Sqft/Day): ${(jobSqft / 450).toFixed(2)} Days`);
      doc.moveDown();

      // Financial Summary
      doc.fontSize(14).text(`Total Paid Amount: BDT ${Number(totalAmount).toLocaleString()}`, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`- Mistri Pool Share (80%): BDT ${shareBreakup.mistriShare || 0}`);
      doc.text(`- Agent Share: BDT ${shareBreakup.agentShare || 0}`);
      doc.text(`- Platform Service Fee: BDT ${shareBreakup.platformShare || 0}`);
      doc.moveDown(2);

      doc.fontSize(9).fillColor('gray').text('Generated automatically by v3.0.0 Self-Healing System.', { align: 'center' });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoicePdfBuffer };
