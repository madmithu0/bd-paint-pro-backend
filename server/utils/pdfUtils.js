const PDFDocument = require('pdfkit');

function buildPDF(title, lines) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(18).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(11);
      for (const line of lines) {
        doc.text(String(line == null ? '' : line));
      }
      doc.moveDown();
      doc.fontSize(9).text('Generated: ' + new Date().toLocaleString('en-GB'), { align: 'right' });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sendPDF(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.setHeader('Content-Length', buffer.length);
  return res.end(buffer);
}

function formatJobLines(job) {
  const j = job || {};
  const date = j.createdAt ? new Date(j.createdAt).toLocaleDateString('en-GB') : '-';
  return [
    'Job ID: ' + (j._id || j.id || '-'),
    'Customer: ' + (j.customerName || j.customer || '-'),
    'Mistri: ' + (j.mistriName || j.worker || '-'),
    'Sqft: ' + (j.sqft || 0),
    'Days: ' + (j.days || 0),
    'Total: ' + (j.totalAmount || j.amount || 0) + ' TK',
    'Mistri Share (80%): ' + (j.mistriShare || 0) + ' TK',
    'Agent Share: ' + (j.agentShare || 0) + ' TK',
    'Platform Share: ' + (j.platformShare || 0) + ' TK',
    'Status: ' + (j.status || '-'),
    'Date: ' + date
  ];
}

async function createPDF(input, res) {
  const title = input && input.title ? String(input.title) : 'PDF Document';
  const lines = input && Array.isArray(input.lines) ? input.lines : [];
  const buffer = await buildPDF(title, lines);
  if (res) return sendPDF(res, buffer, title.replace(/\s+/g, '_') + '.pdf');
  return buffer;
}

async function makeInvoice(job, res) {
  const lines = ['INVOICE', '------------------------------'].concat(formatJobLines(job)).concat(['', 'Payment: Bkash / Nagad / Cash', 'Thank you for using our service.']);
  const buffer = await buildPDF('Invoice', lines);
  if (res) return sendPDF(res, buffer, 'Invoice.pdf');
  return buffer;
}

async function makeReceipt(payment, res) {
  const p = payment || {};
  const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const lines = [
    'RECEIPT',
    '------------------------------',
    'Payment ID: ' + (p._id || p.id || '-'),
    'Job ID: ' + (p.job || p.jobId || '-'),
    'Method: ' + (p.method || '-'),
    'Amount: ' + (p.amount || 0) + ' TK',
    'TrxID: ' + (p.trxId || p.transactionId || '-'),
    'Status: ' + (p.status || 'paid'),
    'Date: ' + date
  ];
  const buffer = await buildPDF('Receipt', lines);
  if (res) return sendPDF(res, buffer, 'Receipt.pdf');
  return buffer;
}

async function makeExport(input, res) {
  const title = input && input.title ? String(input.title) : 'Export';
  const rows = input && Array.isArray(input.rows) ? input.rows : [];
  const lines = ['Export Type: ' + title, 'Total Rows: ' + rows.length, '------------------------------'];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    lines.push((i + 1) + '. ' + (typeof r === 'string' ? r : JSON.stringify(r)));
  }
  const buffer = await buildPDF(title, lines);
  if (res) return sendPDF(res, buffer, title.replace(/\s+/g, '_') + '.pdf');
  return buffer;
}

module.exports = { createPDF, makeInvoice, makeReceipt, makeExport, buildPDF };