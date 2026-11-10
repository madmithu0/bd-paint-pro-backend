const ExcelJS = require('exceljs');

function buildWorkbook(title, headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title || 'Sheet1');
  const safeHeaders = Array.isArray(headers) && headers.length ? headers : ['Data'];
  sheet.columns = safeHeaders.map((h) => ({ header: String(h), key: String(h), width: 20 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows || []) {
    if (Array.isArray(row)) {
      sheet.addRow(row);
    } else if (row && typeof row === 'object') {
      const values = safeHeaders.map((h) => (row[h] == null ? '' : row[h]));
      sheet.addRow(values);
    } else {
      sheet.addRow([row == null ? '' : String(row)]);
    }
  }
  return workbook;
}

async function workbookToBuffer(workbook) {
  return workbook.xlsx.writeBuffer();
}

function sendExcel(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.setHeader('Content-Length', buffer.length);
  return res.end(buffer);
}

async function createExcel(input, res) {
  const title = input && input.title ? String(input.title) : 'Export';
  const headers = input && Array.isArray(input.headers) ? input.headers : [];
  const rows = input && Array.isArray(input.rows) ? input.rows : [];
  const workbook = buildWorkbook(title, headers, rows);
  const buffer = await workbookToBuffer(workbook);
  if (res) return sendExcel(res, buffer, title.replace(/\s+/g, '_') + '.xlsx');
  return buffer;
}

async function exportExcel(input, res) {
  return createExcel(input, res);
}

async function downloadExcel(input, res) {
  return createExcel(input, res);
}

async function makeTemplate(type, res) {
  let headers = [];
  let title = 'Template';
  if (type === 'job') {
    title = 'Job_Template';
    headers = ['customerName', 'phone', 'address', 'sqft', 'type', 'date'];
  } else if (type === 'payment') {
    title = 'Payment_Template';
    headers = ['jobId', 'method', 'amount', 'trxId', 'status'];
  } else if (type === 'user') {
    title = 'User_Template';
    headers = ['name', 'email', 'phone', 'role'];
  } else {
    headers = ['column1', 'column2', 'column3'];
  }
  const workbook = buildWorkbook(title, headers, []);
  const buffer = await workbookToBuffer(workbook);
  if (res) return sendExcel(res, buffer, title + '.xlsx');
  return buffer;
}

module.exports = { createExcel, exportExcel, downloadExcel, makeTemplate, buildWorkbook };