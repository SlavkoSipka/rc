// Builds the export invoice as an .xlsx in the exact layout of the invoices Bora - Company
// issued by hand (BC-E-CRCP ... .xls). exportInvoiceTemplate.json holds that layout (column
// widths, row heights, merged cells, fonts, borders and the fixed texts) without any order data.
//
// Template rows (1-based):  1-28 header and table head | 29 item row | 34 shipping row |
// 35-52 totals, exchange rate, VAT note and signatures. Every item takes two rows here: the
// original item row, then a row with what FedEx / EU customs ask for per item (material,
// purpose, origin, HS code, product identifiers).

import type { Borders, Cell, Fill, Font, Style, Worksheet } from 'exceljs';
import { formatIdentifiersForCustoms } from '../../lib/productIdentifiers';
import template from './exportInvoiceTemplate.json';
import {
  formatDateSr,
  invoiceFileName,
  invoiceNumberText,
  invoiceTotals,
  lineAmount,
  lineNetWeight
} from './invoiceLogic';
import type { InvoiceData, InvoiceLine } from './types';

interface TemplateStyle {
  font: { name: string; size: number; bold?: boolean; italic?: boolean; underline?: boolean; color?: string };
  alignment: Record<string, string | boolean>;
  border?: Record<string, { style: string; color?: string }>;
  fill?: string;
  numFmt?: string;
}

interface TemplateCell {
  s: number;
  v?: string | number;
}

const ITEM_ROW = 29;
const SHIPPING_ROW = 34;
const FOOTER_FIRST_ROW = 35;
const LAST_COLUMN = template.columns.length; // AL

const styles = template.styles as TemplateStyle[];
const rows = template.rows as { height: number; cells: Record<string, TemplateCell> }[];

function toExcelStyle(style: TemplateStyle): Partial<Style> {
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

const excelStyles = styles.map(toExcelStyle);

function applyStyle(cell: Cell, styleIndex: number) {
  const style = excelStyles[styleIndex];
  // Copies, so changing one cell's font never changes another cell sharing the style
  cell.style = JSON.parse(JSON.stringify(style));
}

// Copies template row `from` (styles, height, fixed texts and merges) to output row `to`
function copyRow(ws: Worksheet, from: number, to: number, { values = true, merges = true } = {}) {
  const source = rows[from - 1];
  ws.getRow(to).height = source.height;
  if (merges) {
    for (const [r1, c1, r2, c2] of template.merges as number[][]) {
      if (r1 === from && r2 === from) ws.mergeCellsWithoutStyle(to, c1, to, c2);
    }
  }
  for (const [column, cell] of Object.entries(source.cells)) {
    const target = ws.getCell(`${column}${to}`);
    applyStyle(target, cell.s);
    if (values && cell.v !== undefined) target.value = cell.v;
  }
}

function set(ws: Worksheet, address: string, value: string | number | null) {
  ws.getCell(address).value = value;
}

function customsDetails(line: InvoiceLine, purpose: string) {
  return [
    `Material: ${line.material || '-'}`,
    `Purpose: ${purpose}`,
    `Origin: ${line.countryOfOrigin || '-'}`,
    `HS: ${line.hsCode}`,
    formatIdentifiersForCustoms(line)
  ].join(' | ');
}

const kg = (value: number) => value.toFixed(3).replace('.', ',');

export async function buildInvoiceWorkbook(invoice: InvoiceData) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Custom RC Parts';
  const ws = workbook.addWorksheet('EXPORT-EUR');
  template.columns.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });

  const totals = invoiceTotals(invoice);

  // Header and table head, merges spanning several rows included
  for (const [r1, c1, r2, c2] of template.merges as number[][]) {
    if (r2 < ITEM_ROW && r1 !== r2) ws.mergeCellsWithoutStyle(r1, c1, r2, c2);
  }
  for (let r = 1; r < ITEM_ROW; r++) copyRow(ws, r, r);

  set(ws, 'L11', invoiceNumberText(invoice));
  set(ws, 'I12', formatDateSr(invoice.invoiceDate));
  set(ws, 'I14', invoice.invoicePlace);
  set(ws, 'K16', formatDateSr(invoice.deliveryDate));
  set(ws, 'K18', invoice.deliveryPlace);
  set(ws, 'F20', invoice.transactionId);
  set(ws, 'F22', invoice.paymentMethod);
  set(ws, 'W10', invoice.invoiceTo);
  set(ws, 'W16', invoice.shipTo);

  // Items: the original item row, then the customs row under it
  let row = ITEM_ROW;
  invoice.lines.forEach((line, index) => {
    copyRow(ws, ITEM_ROW, row, { values: false });
    set(ws, `A${row}`, index + 1);
    set(ws, `B${row}`, line.description);
    set(ws, `K${row}`, line.unit);
    set(ws, `M${row}`, line.quantity);
    set(ws, `P${row}`, line.unitPrice);
    set(ws, `S${row}`, line.unitNetWeightKg);
    set(ws, `T${row}`, line.unitNetWeightKg == null ? null : lineNetWeight(line));
    const amount = lineAmount(line);
    set(ws, `U${row}`, amount);
    set(ws, `Y${row}`, amount);
    set(ws, `AG${row}`, amount);
    row++;

    copyRow(ws, ITEM_ROW, row, { values: false, merges: false });
    ws.mergeCellsWithoutStyle(row, 2, row, LAST_COLUMN);
    const details = ws.getCell(`B${row}`);
    details.value = customsDetails(line, invoice.purpose);
    details.font = { name: 'Arial', size: 7, italic: true };
    details.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    ws.getRow(row).height = 21;
    row++;
  });

  copyRow(ws, SHIPPING_ROW, row, { values: false });
  if (invoice.shipping > 0) {
    set(ws, `A${row}`, invoice.lines.length + 1);
    set(ws, `B${row}`, 'Shipping - Troškovi transporta');
    set(ws, `P${row}`, invoice.shipping);
    set(ws, `U${row}`, invoice.shipping);
    set(ws, `Y${row}`, invoice.shipping);
    set(ws, `AG${row}`, invoice.shipping);
  }
  row++;

  // Totals, exchange rate, VAT note and signatures, shifted below the items
  const shift = row - FOOTER_FIRST_ROW;
  for (let r = FOOTER_FIRST_ROW; r <= rows.length; r++) copyRow(ws, r, r + shift);
  const at = (column: string, templateRow: number) => `${column}${templateRow + shift}`;

  const hsCodes = [...new Set(invoice.lines.map((line) => line.hsCode))];
  const hs = hsCodes.length === 1 ? hsCodes[0] : 'see items';
  set(ws, at('B', 37), `Tarifni broj: ${hs}`);
  set(ws, at('B', 38), `HS Tariff-Nr: ${hs}`);
  const origins = [...new Set(invoice.lines.map((line) => line.countryOfOrigin))];
  set(ws, at('B', 39), `Country of origin: ${origins.length === 1 ? origins[0] : 'see items'}`);
  set(ws, at('T', 37), totals.totalPieces);
  set(ws, at('T', 39), totals.netWeightKg);
  set(ws, at('U', 41), totals.total);
  set(ws, at('Y', 41), totals.total);
  set(ws, at('AG', 41), totals.total);
  set(ws, at('AD', 42), totals.total);
  set(ws, at('AG', 43), totals.totalRsd);
  set(ws, at('Y', 44), formatDateSr(invoice.invoiceDate));
  set(ws, at('AF', 44), invoice.exchangeRate);
  set(ws, at('D', 52), `Bruto weight:  ~ ${kg(totals.grossWeightKg)}kg          Collet = ${invoice.packaging}`);

  const lastRow = rows.length + shift;
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    printArea: `A1:AL${lastRow}`,
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
