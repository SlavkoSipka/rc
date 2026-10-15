import type { AdminOrder, ProductInvoiceData } from '../adminData';
import { highestInvoiceNumber } from '../adminData';
import { INVOICE_COUNTRY_NAMES, INVOICE_DEFAULTS, LAST_INVOICE_NUMBER_BEFORE_ADMIN } from './invoiceDefaults';
import type { InvoiceData, InvoiceLine } from './types';

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 2026-10-07 -> 07.10.2026
export const formatDateSr = (iso: string) => {
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}.${month}.${year}` : iso;
};

export const invoiceNumberText = (invoice: Pick<InvoiceData, 'prefix' | 'number' | 'year'>) =>
  `${invoice.prefix} ${invoice.number}/${invoice.year}`;

export function lineAmount(line: InvoiceLine) {
  return round2(line.quantity * line.unitPrice);
}

export function lineNetWeight(line: InvoiceLine) {
  return line.unitNetWeightKg == null ? 0 : round3(line.quantity * line.unitNetWeightKg);
}

export function invoiceTotals(invoice: InvoiceData) {
  const itemsTotal = round2(invoice.lines.reduce((sum, line) => sum + lineAmount(line), 0));
  const total = round2(itemsTotal + invoice.shipping);
  const totalPieces = invoice.lines.reduce((sum, line) => sum + line.quantity, 0);
  const netWeightKg = round3(invoice.lines.reduce((sum, line) => sum + lineNetWeight(line), 0));
  const grossWeightKg = invoice.grossWeightKg ?? round3(netWeightKg + INVOICE_DEFAULTS.packagingWeightKg);
  const totalRsd = invoice.exchangeRate ? Math.round(total * invoice.exchangeRate * 10000) / 10000 : null;
  return { itemsTotal, total, totalPieces, netWeightKg, grossWeightKg, totalRsd };
}

// What has to be fixed before the invoice can go out
export function invoiceProblems(invoice: InvoiceData): string[] {
  const problems: string[] = [];
  if (!invoice.prefix.trim() || !invoice.number || !invoice.year) problems.push('Broj fakture nije popunjen.');
  if (!invoice.invoiceTo.trim()) problems.push('Kupac (Invoice to) nije popunjen.');
  if (invoice.lines.length === 0) problems.push('Faktura nema nijednu stavku.');
  invoice.lines.forEach((line, index) => {
    const n = index + 1;
    if (!line.description.trim()) problems.push(`Stavka ${n}: nema opisa.`);
    if (!(line.quantity > 0)) problems.push(`Stavka ${n}: količina mora biti veća od 0.`);
    if (line.unitNetWeightKg == null) problems.push(`Stavka ${n}: nije upisana neto težina po komadu.`);
    if (!line.material.trim()) problems.push(`Stavka ${n}: nije upisan materijal.`);
    if (!line.countryOfOrigin.trim()) problems.push(`Stavka ${n}: nije upisana zemlja porekla.`);
    if (!line.merchantProductId.trim() || !line.manufacturerProductId.trim()) {
      problems.push(`Stavka ${n}: nedostaje M-PID ili NS-PID (obavezno za EU od 1.11.2026).`);
    }
  });
  if (!invoice.exchangeRate) problems.push('Nema srednjeg kursa NBS.');
  return problems;
}

// "Justin Musial / 13011 S Elizabeth Dr / Plainfield, IL 60585 / United States of America"
export function addressBlock(order: AdminOrder) {
  const name = [order.first_name, order.last_name].filter(Boolean).join(' ');
  const code = (order.country_code || '').toUpperCase();
  const cityLine = ['US', 'CA', 'AU'].includes(code)
    ? `${order.city || ''}, ${[order.state, order.zip_code].filter(Boolean).join(' ')}`
    : [[order.zip_code, order.city].filter(Boolean).join(' '), order.state].filter(Boolean).join(', ');
  const country = INVOICE_COUNTRY_NAMES[code] || order.country || '';
  return [name, order.address, order.address2, cityLine.trim().replace(/^,\s*/, ''), country]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join('\n');
}

export function lineFromProduct(
  product: ProductInvoiceData | undefined,
  fallback: { productId: string | null; title: string }
): InvoiceLine {
  return {
    productId: fallback.productId,
    description: product?.invoice_description || fallback.title,
    unit: INVOICE_DEFAULTS.unit,
    quantity: 1,
    unitPrice: 0,
    unitNetWeightKg: product?.net_weight_kg ?? null,
    material: product?.material || '',
    countryOfOrigin: product?.country_of_origin || '',
    hsCode: product?.hs_code || INVOICE_DEFAULTS.hsCode,
    merchantProductId: product?.merchant_product_id || '',
    manufacturerProductId: product?.manufacturer_product_id || '',
    standardProductId: product?.standard_product_id || '',
    piecesPerUnit: product?.pieces_per_unit || 1
  };
}

// Applies "pieces per sold unit" to an order line: quantity and price per piece follow from it
export function withPiecesPerUnit(line: InvoiceLine, piecesPerUnit: number): InvoiceLine {
  const pieces = Math.max(1, Math.round(piecesPerUnit) || 1);
  if (line.orderQuantity == null || line.orderUnitPrice == null) return { ...line, piecesPerUnit: pieces };
  return {
    ...line,
    piecesPerUnit: pieces,
    quantity: line.orderQuantity * pieces,
    unitPrice: round2(line.orderUnitPrice / pieces)
  };
}

export async function suggestInvoiceNumber(prefix: string, year: number) {
  const highest = await highestInvoiceNumber(prefix, year);
  const before = LAST_INVOICE_NUMBER_BEFORE_ADMIN[`${prefix}/${year}`] ?? 0;
  return Math.max(highest, before) + 1;
}

// NBS middle rate EUR -> RSD valid on the given date (kurs.resenje.org mirrors the NBS list)
export async function fetchNbsEurRate(isoDate: string): Promise<number | null> {
  try {
    const response = await fetch(`https://kurs.resenje.org/api/v1/currencies/eur/rates/${isoDate}`);
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.exchange_middle === 'number' ? data.exchange_middle : null;
  } catch {
    return null;
  }
}

function baseInvoice(): InvoiceData {
  const today = todayIso();
  return {
    prefix: INVOICE_DEFAULTS.prefix,
    number: 0,
    year: Number(today.slice(0, 4)),
    invoiceDate: today,
    deliveryDate: today,
    invoicePlace: INVOICE_DEFAULTS.place,
    deliveryPlace: INVOICE_DEFAULTS.place,
    transactionId: '',
    paymentMethod: INVOICE_DEFAULTS.paymentMethod,
    invoiceTo: '',
    shipTo: '',
    lines: [],
    shipping: 0,
    exchangeRate: null,
    grossWeightKg: null,
    packaging: INVOICE_DEFAULTS.packaging,
    purpose: INVOICE_DEFAULTS.purpose,
    orderTotal: null
  };
}

export function blankInvoice(): InvoiceData {
  return baseInvoice();
}

export function invoiceFromOrder(order: AdminOrder, products: Record<string, ProductInvoiceData>): InvoiceData {
  const address = addressBlock(order);
  const lines = [...order.order_items]
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const product = item.product_id ? products[item.product_id] : undefined;
      const line = lineFromProduct(product, { productId: item.product_id, title: item.title });
      // Identifiers as they were when the order was placed
      if (item.merchant_product_id) line.merchantProductId = item.merchant_product_id;
      if (item.manufacturer_product_id) line.manufacturerProductId = item.manufacturer_product_id;
      if (item.standard_product_id) line.standardProductId = item.standard_product_id;
      line.orderTitle = item.title;
      line.orderQuantity = item.quantity;
      line.orderUnitPrice = Number(item.unit_price);
      return withPiecesPerUnit(line, line.piecesPerUnit);
    });
  return {
    ...baseInvoice(),
    transactionId: order.paypal_capture_id || order.paypal_order_id || '',
    invoiceTo: address,
    shipTo: address,
    lines,
    shipping: Number(order.shipping),
    orderTotal: Number(order.total)
  };
}

// First line of the address block, used in lists and the file name
export const customerName = (invoice: InvoiceData) => invoice.invoiceTo.split('\n')[0]?.trim() || '';

export const invoiceFileName = (invoice: InvoiceData) =>
  `${invoice.prefix.trim().replace(/\s+/g, '_')}_${invoice.number}_${customerName(invoice) || 'invoice'}.xlsx`
    .replace(/[\\/:*?"<>|]/g, '');
