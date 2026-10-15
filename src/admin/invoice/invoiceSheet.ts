// The export invoice as a sheet: every cell with its value and style, merged cells, column
// widths and row heights, in the exact layout of the invoices Bora - Company issued by hand
// (BC-E-CRCP ... .xls). The .xlsx download (invoiceXlsx) and the on-screen preview
// (InvoicePreview) are both drawn from this, so the preview shows what will be printed.
//
// exportInvoiceTemplate.json holds the layout without any order data. Template rows (1-based):
// 1-28 header and table head | 29 item row | 34 shipping row | 35-52 totals, exchange rate,
// VAT note and signatures. Every item takes two rows here: the original item row, then a row
// with what FedEx / EU customs ask for per item (material, purpose, origin, HS code, IDs).

import { formatIdentifiersForCustoms } from '../../lib/productIdentifiers';
import template from './exportInvoiceTemplate.json';
import { formatDateSr, invoiceNumberText, invoiceTotals, lineAmount, lineNetWeight } from './invoiceLogic';
import type { InvoiceData, InvoiceLine } from './types';

export interface SheetStyle {
  font: { name: string; size: number; bold?: boolean; italic?: boolean; underline?: boolean; color?: string };
  alignment: { horizontal?: string; vertical?: string; wrapText?: boolean };
  border?: Record<string, { style: string; color?: string }>;
  fill?: string;
  numFmt?: string;
}

export interface SheetCell {
  value: string | number | null;
  style: SheetStyle;
}

export interface InvoiceSheet {
  columns: number[];                       // widths in Excel characters, A..AL
  rows: { height: number; cells: SheetCell[] }[];
  merges: [number, number, number, number][]; // 1-based [row1, col1, row2, col2]
}

interface TemplateCell {
  s: number;
  v?: string | number;
}

const ITEM_ROW = 29;
const SHIPPING_ROW = 34;
const FOOTER_FIRST_ROW = 35;

const styles = template.styles as SheetStyle[];
const templateRows = template.rows as { height: number; cells: Record<string, TemplateCell> }[];
const templateMerges = template.merges as [number, number, number, number][];
const COLUMN_COUNT = template.columns.length; // 38 = A..AL

export const columnIndex = (letters: string) =>
  letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// Cells of the layout that stay the same on every invoice but can be changed in the editor
export const EDITABLE_FIXED_TEXTS: { address: string; label: string }[] = [
  { address: 'M1', label: 'Naziv firme' },
  { address: 'M2', label: 'Adresa' },
  { address: 'M3', label: 'Sedište' },
  { address: 'L4', label: 'PIB' },
  { address: 'V4', label: 'EPPDV' },
  { address: 'N5', label: 'Kontrolni broj' },
  { address: 'Y5', label: 'Matični broj' },
  { address: 'O6', label: 'Tekući račun' },
  { address: 'J7', label: 'IBAN / BIC' },
  { address: 'M8', label: 'Telefon' },
  { address: 'W8', label: 'Fax' },
  { address: 'AD8', label: 'Web' },
  { address: 'M9', label: 'E-pošta' },
  { address: 'V23', label: 'Napomena iznad tabele' },
  { address: 'K44', label: 'Napomena o PDV-u (1. red)' },
  { address: 'A45', label: 'Napomena o PDV-u (2. red)' },
  { address: 'K47', label: 'Odgovorno lice' },
  { address: 'V47', label: 'Adresa i telefon odgovornog lica' }
];

export function templateText(address: string): string {
  const match = /^([A-Z]+)(\d+)$/.exec(address);
  if (!match) return '';
  const value = templateRows[Number(match[2]) - 1]?.cells[match[1]]?.v;
  return value == null ? '' : String(value).trim();
}

export function customsText(line: InvoiceLine, purpose: string) {
  return [
    `Material: ${line.material || '-'}`,
    `Purpose: ${purpose}`,
    `Origin: ${line.countryOfOrigin || '-'}`,
    `HS: ${line.hsCode}`,
    formatIdentifiersForCustoms(line)
  ].join(' | ');
}

export function defaultHsSummary(invoice: InvoiceData) {
  const codes = [...new Set(invoice.lines.map((line) => line.hsCode))];
  return codes.length === 1 ? codes[0] : 'see items';
}

export function defaultOriginSummary(invoice: InvoiceData) {
  const origins = [...new Set(invoice.lines.map((line) => line.countryOfOrigin))];
  return origins.length === 1 ? origins[0] : 'see items';
}

export const DEFAULT_SHIPPING_LABEL = 'Shipping - Troškovi transporta';

const kg = (value: number) => value.toFixed(3).replace('.', ',');

export function buildInvoiceSheet(invoice: InvoiceData): InvoiceSheet {
  const totals = invoiceTotals(invoice);
  const rows: InvoiceSheet['rows'] = [];
  const merges: InvoiceSheet['merges'] = [];
  const fixedTexts = invoice.fixedTexts ?? {};

  const ensureRow = (r: number) => {
    while (rows.length < r) rows.push({ height: 12.75, cells: [] });
    return rows[r - 1];
  };

  // Copies template row `from` (height, styles, fixed texts, single-row merges) to row `to`
  const copyRow = (from: number, to: number, { values = true, merges: withMerges = true } = {}) => {
    const source = templateRows[from - 1];
    const row = ensureRow(to);
    row.height = source.height;
    row.cells = Array.from({ length: COLUMN_COUNT }, (_, c) => {
      const letters = columnLetters(c);
      const cell = source.cells[letters];
      let value: string | number | null = values && cell?.v !== undefined ? cell.v : null;
      // Edited fixed text keeps the original leading spaces, which position it in the layout
      const edited = values ? fixedTexts[`${letters}${from}`] : undefined;
      if (edited !== undefined && from === to) {
        const padding = typeof cell?.v === 'string' ? (/^\s*/.exec(cell.v)?.[0] ?? '') : '';
        value = edited.trim() === '' ? null : padding + edited.trim();
      }
      return { value, style: styles[cell?.s ?? 0] };
    });
    if (withMerges) {
      for (const [r1, c1, r2, c2] of templateMerges) {
        if (r1 === from && r2 === from) merges.push([to, c1, to, c2]);
      }
    }
  };

  const set = (address: string, value: string | number | null) => {
    const match = /^([A-Z]+)(\d+)$/.exec(address);
    if (!match) return;
    ensureRow(Number(match[2])).cells[columnIndex(match[1])].value = value;
  };

  // Header and table head, merges spanning several rows included
  for (const merge of templateMerges) {
    if (merge[2] < ITEM_ROW && merge[0] !== merge[2]) merges.push(merge);
  }
  for (let r = 1; r < ITEM_ROW; r++) copyRow(r, r);

  set('L11', invoiceNumberText(invoice));
  set('I12', formatDateSr(invoice.invoiceDate));
  set('I14', invoice.invoicePlace);
  set('K16', formatDateSr(invoice.deliveryDate));
  set('K18', invoice.deliveryPlace);
  set('F20', invoice.transactionId);
  set('F22', invoice.paymentMethod);
  set('W10', invoice.invoiceTo);
  set('W16', invoice.shipTo);

  // Items: the original item row, then the customs row under it
  let row = ITEM_ROW;
  invoice.lines.forEach((line, index) => {
    copyRow(ITEM_ROW, row, { values: false });
    set(`A${row}`, index + 1);
    set(`B${row}`, line.description);
    set(`K${row}`, line.unit);
    set(`M${row}`, line.quantity);
    set(`P${row}`, line.unitPrice);
    set(`S${row}`, line.unitNetWeightKg);
    set(`T${row}`, line.unitNetWeightKg == null ? null : lineNetWeight(line));
    const amount = lineAmount(line);
    set(`U${row}`, amount);
    set(`Y${row}`, amount);
    set(`AC${row}`, line.vatPercent || null);
    set(`AD${row}`, line.orderNumber || null);
    set(`AG${row}`, amount);
    row++;

    copyRow(ITEM_ROW, row, { values: false, merges: false });
    merges.push([row, 2, row, COLUMN_COUNT]);
    const details = rows[row - 1].cells[1];
    details.value = line.customsText?.trim() || customsText(line, invoice.purpose);
    details.style = {
      ...details.style,
      font: { name: 'Arial', size: 7, italic: true },
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true }
    };
    rows[row - 1].height = 21;
    row++;
  });

  copyRow(SHIPPING_ROW, row, { values: false });
  if (invoice.shipping > 0) {
    set(`A${row}`, invoice.lines.length + 1);
    set(`B${row}`, invoice.shippingLabel?.trim() || DEFAULT_SHIPPING_LABEL);
    set(`P${row}`, invoice.shipping);
    set(`U${row}`, invoice.shipping);
    set(`Y${row}`, invoice.shipping);
    set(`AG${row}`, invoice.shipping);
  }
  row++;

  // Totals, exchange rate, VAT note and signatures, shifted below the items
  const shift = row - FOOTER_FIRST_ROW;
  for (let r = FOOTER_FIRST_ROW; r <= templateRows.length; r++) {
    copyRow(r, r + shift);
    // Fixed texts of the footer (VAT note, responsible person) are edited by template address
    for (const { address } of EDITABLE_FIXED_TEXTS) {
      const match = /^([A-Z]+)(\d+)$/.exec(address);
      if (match && Number(match[2]) === r && fixedTexts[address] !== undefined) {
        const original = templateRows[r - 1].cells[match[1]]?.v;
        const padding = typeof original === 'string' ? (/^\s*/.exec(original)?.[0] ?? '') : '';
        const text = fixedTexts[address].trim();
        set(`${match[1]}${r + shift}`, text === '' ? null : padding + text);
      }
    }
  }
  const at = (column: string, templateRow: number) => `${column}${templateRow + shift}`;

  const hs = invoice.hsSummary?.trim() || defaultHsSummary(invoice);
  set(at('B', 37), `Tarifni broj: ${hs}`);
  set(at('B', 38), `HS Tariff-Nr: ${hs}`);
  set(at('B', 39), `Country of origin: ${invoice.originSummary?.trim() || defaultOriginSummary(invoice)}`);
  set(at('T', 37), totals.totalPieces);
  set(at('T', 39), totals.netWeightKg);
  set(at('U', 41), totals.total);
  set(at('Y', 41), totals.total);
  set(at('AG', 41), totals.total);
  set(at('AD', 42), totals.total);
  set(at('AG', 43), totals.totalRsd);
  set(at('Y', 44), formatDateSr(invoice.invoiceDate));
  set(at('AF', 44), invoice.exchangeRate);
  set(at('D', 52), `Bruto weight:  ~ ${kg(totals.grossWeightKg)}kg          Collet = ${invoice.packaging}`);

  return { columns: template.columns, rows, merges };
}

function columnLetters(index: number) {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}
