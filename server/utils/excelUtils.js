const ExcelJS = require('exceljs');

const generateExcelReportBuffer = async ({ sheetName = 'Report', columns = [], rows = [] }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Enterprise Paint System v3.0.0';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns;

  // Style Header Row
  worksheet.getRow(1).font = { bold: true };

  rows.forEach((row) => {
    worksheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = { generateExcelReportBuffer };
