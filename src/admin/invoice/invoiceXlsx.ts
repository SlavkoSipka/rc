// Writes the export invoice sheet (invoiceSheet) as an .xlsx with ExcelJS, which is loaded
// only when an invoice is downloaded.

import type { Borders, Fill, Font, Style } from 'exceljs';
import { invoiceFileName } from './invoiceLogic';
import { InvoiceSheet, SheetStyle, buildInvoiceSheet } from './invoiceSheet';
import type { InvoiceData } from './types';

function toExcelStyle(style: SheetStyle): Partial<Style> {
  const font: Partial<Font> = { name: style.font.name, size: style.font.size };
  if (style.font.bold) font.bold = true;
  if (style.font.italic) font.italic = true;
  if (style.font.underline) font.underline = true;
  if (style.font.color) font.color = { argb: style.font.color };
  const result: Partial<Style> = { font, alignment: style.alignment as Style['alignment'] };
  if (style.border) {
    const border: Partial<Borders> = {};
    for (const [side, edge] of Object.entries(style.border)) {
      border[side as 'left'] = { style: edge.style as 'thin', ...(edge.color ? { color: { argb: edge.color } } : {}) };
    }
    result.border = border;
  }
  if (style.fill) result.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } } as Fill;
  if (style.numFmt) result.numFmt = style.numFmt;
  return result;
}

export async function buildInvoiceWorkbook(invoice: InvoiceData) {
  const sheet: InvoiceSheet = buildInvoiceSheet(invoice);
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Custom RC Parts';
  const ws = workbook.addWorksheet('EXPORT-EUR');
  sheet.columns.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });

  // Merged without taking over the first cell's style, so every cell keeps its own borders
  for (const [r1, c1, r2, c2] of sheet.merges) ws.mergeCellsWithoutStyle(r1, c1, r2, c2);

  const converted = new Map<SheetStyle, Partial<Style>>();
  sheet.rows.forEach((row, r) => {
    ws.getRow(r + 1).height = row.height;
    row.cells.forEach((cell, c) => {
      const target = ws.getCell(r + 1, c + 1);
      if (!converted.has(cell.style)) converted.set(cell.style, toExcelStyle(cell.style));
      // Copies, so changing one cell's style never changes another cell sharing it
      target.style = JSON.parse(JSON.stringify(converted.get(cell.style)));
      if (cell.value !== null) target.value = cell.value;
    });
  });

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    printArea: `A1:AL${sheet.rows.length}`,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
  };

  return workbook;
}

export async function downloadInvoiceXlsx(invoice: InvoiceData) {
  const workbook = await buildInvoiceWorkbook(invoice);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = invoiceFileName(invoice);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
