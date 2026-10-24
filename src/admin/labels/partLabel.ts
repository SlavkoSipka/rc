// The part label stuck on the bag header card: 60 x 9 mm, our code (M-PID) in large letters,
// two short lines of text and a Code 128 barcode of the code. Layout as in the card design
// (dizajn/kartica_19.py). Drawn as SVG for the preview and as a PDF (one label per page, for a
// label printer with a 62 mm roll) for printing.

import { code128Widths } from './code128';

export const LABEL_W = 60;
export const LABEL_H = 9;

export interface PartLabel {
  code: string;   // "CRC-0042"
  name: string;   // "Hinge pin brace · Silver"
  detail: string; // "Tamiya TRF201, 211, 201 XMW"
}

type Op =
  | { kind: 'text'; x: number; y: number; size: number; bold: boolean; grey: boolean; text: string; scaleX: number; anchor: 'start' | 'middle' }
  | { kind: 'rect'; x: number; y: number; w: number; h: number };

const TEXT_X = 2.2;
const BARCODE_W = LABEL_W * 0.34;
const BARCODE_X = LABEL_W - BARCODE_W - 2;
const TEXT_MAX_W = BARCODE_X - 1.5 - TEXT_X; // room left of the barcode, with a quiet zone

// Text width in mm. Arial has the same widths as Helvetica, the font of the PDF.
let canvas: CanvasRenderingContext2D | null = null;
function textWidth(text: string, size: number, bold: boolean) {
  if (typeof document !== 'undefined') {
    canvas ??= document.createElement('canvas').getContext('2d');
    if (canvas) {
      canvas.font = `${bold ? 'bold ' : ''}100px Arial, Helvetica, sans-serif`;
      return (canvas.measureText(text).width / 100) * size;
    }
  }
  return text.length * size * (bold ? 0.6 : 0.55);
}

// A line that is too long is first squeezed (down to 75 %), then made smaller
function fitted(text: string, size: number, bold: boolean, maxWidth: number) {
  const natural = textWidth(text, size, bold);
  if (natural <= maxWidth) return { size, scaleX: 1 };
  const scale = maxWidth / natural;
  return scale >= 0.75 ? { size, scaleX: scale } : { size: (size * scale) / 0.75, scaleX: 0.75 };
}

export function labelOps(label: PartLabel): Op[] {
  const h = LABEL_H;
  const ops: Op[] = [];
  const line = (text: string, y: number, size: number, bold: boolean, grey: boolean) => {
    if (!text.trim()) return;
    ops.push({ kind: 'text', x: TEXT_X, y, ...fitted(text.trim(), size, bold, TEXT_MAX_W), bold, grey, text: text.trim(), anchor: 'start' });
  };
  line(label.code, h * 0.42, h * 0.3, true, false);
  line(label.name, h * 0.66, h * 0.17, false, false);
  line(label.detail, h * 0.86, h * 0.15, false, true);

  const widths = code128Widths(label.code.trim());
  const module = BARCODE_W / widths.reduce((a, b) => a + b, 0);
  let x = BARCODE_X;
  widths.forEach((w, i) => {
    if (i % 2 === 0) ops.push({ kind: 'rect', x, y: h * 0.16, w: w * module, h: h * 0.52 });
    x += w * module;
  });
  ops.push({
    kind: 'text', x: BARCODE_X + BARCODE_W / 2, y: h * 0.88, size: h * 0.14, scaleX: 1,
    bold: false, grey: false, text: label.code.trim(), anchor: 'middle'
  });
  return ops;
}

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The label as SVG, in mm
export function labelSvg(label: PartLabel) {
  const body = labelOps(label).map((op) => {
    if (op.kind === 'rect') return `<rect x="${op.x.toFixed(3)}" y="${op.y.toFixed(3)}" width="${op.w.toFixed(3)}" height="${op.h.toFixed(3)}"/>`;
    const squeeze = op.scaleX < 1 ? ` transform="translate(${op.x} ${op.y}) scale(${op.scaleX} 1) translate(${-op.x} ${-op.y})"` : '';
    return `<text x="${op.x}" y="${op.y}" font-family="Arial, Helvetica, sans-serif" font-size="${op.size.toFixed(3)}"` +
      `${op.bold ? ' font-weight="bold"' : ''} fill="${op.grey ? '#444' : '#000'}" text-anchor="${op.anchor}"${squeeze}>${escapeXml(op.text)}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W}mm" height="${LABEL_H}mm" viewBox="0 0 ${LABEL_W} ${LABEL_H}">` +
    `<rect width="${LABEL_W}" height="${LABEL_H}" fill="#fff"/>${body.join('')}</svg>`;
}

// ---- PDF -------------------------------------------------------------------------------------
// A small PDF writer: vector bars and text in the built-in Helvetica fonts (WinAnsi encoding),
// nothing to embed, so the file stays tiny and prints sharp on any printer.

const PT = 72 / 25.4;
const num = (value: number) => (Math.round(value * 1000) / 1000).toString();

// WinAnsi has š ž but not č ć đ: those are written without the mark
const WIN_ANSI: Record<string, number> = { 'Š': 0x8a, 'š': 0x9a, 'Ž': 0x8e, 'ž': 0x9e, '·': 0xb7, '–': 0x96, '—': 0x97, '’': 0x92 };
const PLAIN: Record<string, string> = { 'č': 'c', 'ć': 'c', 'Č': 'C', 'Ć': 'C', 'đ': 'dj', 'Đ': 'Dj' };

function pdfString(text: string) {
  let out = '';
  for (const ch of [...text].map((c) => PLAIN[c] ?? c).join('')) {
    const code = WIN_ANSI[ch] ?? ch.charCodeAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code >= 32 && code < 127) out += ch;
    else if (code < 256) out += '\\' + code.toString(8).padStart(3, '0');
    else out += '?';
  }
  return `(${out})`;
}

function pageContent(label: PartLabel) {
  const y = (mm: number) => (LABEL_H - mm) * PT; // PDF y runs upwards
  return labelOps(label).map((op) => {
    if (op.kind === 'rect') return `0 g ${num(op.x * PT)} ${num(y(op.y + op.h))} ${num(op.w * PT)} ${num(op.h * PT)} re f`;
    const width = textWidth(op.text, op.size, op.bold) * op.scaleX;
    const x = op.anchor === 'middle' ? op.x - width / 2 : op.x;
    return `BT ${op.grey ? '0.27' : '0'} g /${op.bold ? 'F2' : 'F1'} ${num(op.size * PT)} Tf ${num(op.scaleX * 100)} Tz ` +
      `${num(x * PT)} ${num(y(op.y))} Td ${pdfString(op.text)} Tj ET`;
  }).join('\n');
}

export function labelsPdf(labels: PartLabel[]): Blob {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body); // object number = index + 1
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // pages, filled in below
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pages: number[] = [];
  for (const label of labels) {
    const content = pageContent(label);
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(LABEL_W * PT)} ${num(LABEL_H * PT)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objects.length} 0 R >>`);
    pages.push(objects.length);
  }
  objects[1] = `<< /Type /Pages /Kids [${pages.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;

  // Everything above is plain ASCII, so string length = byte offset
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}
