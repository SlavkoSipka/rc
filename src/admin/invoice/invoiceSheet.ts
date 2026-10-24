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
import { formatDateSr, invoiceNumberText, invoiceTotals, lineAmount, lineNetWeight, round3, round4 } from './invoiceLogic';
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

// Widths of Arial Bold characters in thousandths of the font size. Bold is used for every
// estimate: it is the widest, so a regular or italic text is never given too little room.
const CHAR_WIDTHS: [string, number][] = [
  ["ijlI.,/'| ", 278],
  ['ft-:;()!', 333],
  ['r', 389],
  ['zž', 500],
  ['bdghnopquFLTZđöüßŽ', 611],
  ['EPSVXYŠ', 667],
  ['ABCDHKNRUČĆĐ&', 722],
  ['wGOQ', 778],
  ['M', 833],
  ['m', 889],
  ['W', 944]
];
const charWidth = (ch: string) => CHAR_WIDTHS.find(([chars]) => chars.includes(ch))?.[1] ?? 556;
const textWidth = (text: string) => [...text].reduce((sum, ch) => sum + charWidth(ch), 0) / 1000;

// Width in pixels of a column `chars` Excel characters wide, measured on the generated sheet:
// the description cell (23.82 characters) holds "Servo posts - Nosači servo motora" (16.5 font
// sizes of Arial Bold) on one line, but not 18.6 font sizes
export const columnPx = (chars: number) => Math.round(chars * 7.75);

// Width in pixels of template columns `from`..`to` (letters)
const columnsPx = (from: string, to: string) =>
  template.columns.slice(columnIndex(from), columnIndex(to) + 1).reduce((sum, chars) => sum + columnPx(chars), 0);

// How many lines a text takes in a cell `widthPx` wide with an Arial `fontSize` font.
// Wrapped word by word like Excel does; a word longer than a line is broken where it ends.
function lineCount(text: string | null | undefined, widthPx: number, fontSize: number) {
  if (!text) return 1;
  const perLine = (widthPx - 4) / (fontSize * (4 / 3)); // usable width, in font sizes
  const space = charWidth(' ') / 1000;
  return text.split('\n').reduce((n, part) => {
    let lines = 1;
    let used = 0;
    for (const word of part.split(/\s+/).filter(Boolean)) {
      const width = textWidth(word);
      if (used > 0 && used + space + width <= perLine) {
        used += space + width;
      } else {
        if (used > 0) lines++;
        lines += Math.max(0, Math.ceil(width / perLine) - 1);
        used = width % perLine || Math.min(width, perLine);
      }
    }
    return n + lines;
  }, 0);
}

const DESCRIPTION_PX = columnsPx('B', 'J');
const CUSTOMS_PX = columnsPx('B', 'AL');
const ORDER_NUMBER_PX = columnsPx('AD', 'AF');
const ADDRESS_PX = columnsPx('W', 'AL');

// Height in points of a row whose tallest cell has `lines` lines of an Arial `fontSize` font
// (Excel gives Arial 8 about 11.25 pt per line), plus a little room above and below
const rowHeight = (lines: number, fontSize: number) => Math.ceil(lines * fontSize * 1.4 + 3);

// One format for every weight on the invoice: a fourth decimal (a 0.4 g insert) as soon as any
// weight needs it, so the item weights visibly add up to the total
function weightFormat(invoice: InvoiceData, netWeightKg: number) {
  const weights = [netWeightKg, ...invoice.lines.flatMap((line) => [line.unitNetWeightKg ?? 0, lineNetWeight(line)])];
  return weights.some((value) => round3(value) !== round4(value)) ? '#,##0.0000' : '#,##0.000';
}

export function buildInvoiceSheet(invoice: InvoiceData): InvoiceSheet {
  const totals = invoiceTotals(invoice);
  const kgFormat = weightFormat(invoice, totals.netWeightKg);
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
  // Table heads of the narrow columns were cut off in the original layout: they wrap now, and
  // "VAT Percent" (wider than its column in any font) becomes "VAT %"
  for (const column of ['S', 'T', 'AC']) {
    const cell = rows[23].cells[columnIndex(column)];
    const font = column === 'AC' ? { ...cell.style.font, size: 7 } : cell.style.font;
    cell.style = { ...cell.style, font, alignment: { ...cell.style.alignment, wrapText: true } };
  }
  set('AC24', 'VAT %');

  set('L11', invoiceNumberText(invoice));
  set('I12', formatDateSr(invoice.invoiceDate));
  set('I14', invoice.invoicePlace);
  set('K16', formatDateSr(invoice.deliveryDate));
  set('K18', invoice.deliveryPlace);
  set('F20', invoice.transactionId);
  set('F22', invoice.paymentMethod);
  set('W10', invoice.invoiceTo);
  set('W16', invoice.shipTo);
  // The address boxes have a fixed size: longer addresses get a smaller font so nothing is cut off
  for (const [address, text, rowsTall] of [['W10', invoice.invoiceTo, 5], ['W16', invoice.shipTo, 6]] as const) {
    const cell = rows[Number(address.slice(1)) - 1].cells[columnIndex('W')];
    const lines = lineCount(text, ADDRESS_PX, cell.style.font.size);
    if (lines > rowsTall) {
      const size = Math.max(6, Math.floor((cell.style.font.size * rowsTall) / lines));
      cell.style = { ...cell.style, font: { ...cell.style.font, size } };
    }
  }

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
    for (const column of ['S', 'T']) {
      const cell = rows[row - 1].cells[columnIndex(column)];
      cell.style = { ...cell.style, numFmt: kgFormat };
    }
    const amount = lineAmount(line);
    set(`U${row}`, amount);
    set(`Y${row}`, amount);
    set(`AC${row}`, line.vatPercent || null);
    set(`AD${row}`, line.orderNumber || null);
    set(`AG${row}`, amount);
    // Long descriptions / order numbers wrap inside their cell and the row grows with them
    const description = rows[row - 1].cells[1];
    description.style = { ...description.style, alignment: { ...description.style.alignment, wrapText: true } };
    const orderNumber = rows[row - 1].cells[columnIndex('AD')];
    orderNumber.style = {
      ...orderNumber.style,
      font: { ...orderNumber.style.font, size: (line.orderNumber ?? '').length > 9 ? 6 : orderNumber.style.font.size },
      alignment: { ...orderNumber.style.alignment, wrapText: true }
    };
    const orderNumberSize = orderNumber.style.font.size;
    const itemHeight = Math.max(
      rowHeight(lineCount(line.description, DESCRIPTION_PX, 8), 8),
      rowHeight(lineCount(line.orderNumber, ORDER_NUMBER_PX, orderNumberSize), orderNumberSize)
    );
    rows[row - 1].height = Math.max(templateRows[ITEM_ROW - 1].height, itemHeight);
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
    rows[row - 1].height = Math.max(12, rowHeight(lineCount(details.value as string, CUSTOMS_PX, 7), 7));
    row++;
  });

  copyRow(SHIPPING_ROW, row, { values: false });
  if (invoice.shipping > 0) {
    set(`A${row}`, invoice.lines.length + 1);
    const label = invoice.shippingLabel?.trim() || DEFAULT_SHIPPING_LABEL;
    set(`B${row}`, label);
    const shippingCell = rows[row - 1].cells[1];
    shippingCell.style = { ...shippingCell.style, alignment: { ...shippingCell.style.alignment, wrapText: true } };
    rows[row - 1].height = Math.max(templateRows[SHIPPING_ROW - 1].height, rowHeight(lineCount(label, DESCRIPTION_PX, 8), 8));
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
  const netCell = rows[39 + shift - 1].cells[columnIndex('T')];
  netCell.style = { ...netCell.style, numFmt: kgFormat };
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
