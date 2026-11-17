import { INVOICE_DEFAULTS } from '../invoice/invoiceDefaults';
import { formatDateSr, formatKg, invoiceTotals, todayIso } from '../invoice/invoiceLogic';
import type { InvoiceData } from '../invoice/types';
import type { Cn22Category, ShippingLabel } from './shippingSheet';

// What stays the same from shipment to shipment, remembered in this browser
const STORAGE_KEY = 'admin-shipping-label';
export interface ShippingSettings {
  sender: string;
  contentsTemplate: string; // {n} = number of pieces
  category: Cn22Category;
  otherText: string;
  hsCode: string;
  origin: string;
  nextStrip: number;        // first free strip of the sheet in the printer
  printed: string[];        // invoices whose envelope was printed (latest last)
}
const DEFAULTS: ShippingSettings = {
  sender: 'Bora Company Doo\nVuka Karadžića 6\nRuđinci\n36217 Vrnjci\nSerbia',
  contentsTemplate: '{n} PCS OF MODEL TOY CAR PARTS',
  category: 'ecommerce',
  otherText: '',
  hsCode: INVOICE_DEFAULTS.hsCode,
  origin: INVOICE_DEFAULTS.countryOfOrigin,
  nextStrip: 0,
  printed: []
};

export function readShippingSettings(): ShippingSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<ShippingSettings>) };
  } catch {
    return DEFAULTS;
  }
}
export function writeShippingSettings(value: ShippingSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, printed: value.printed.slice(-300) }));
  } catch {
    // Storage blocked: the values are simply not remembered
  }
}

export const CN22_CATEGORIES: [Cn22Category, string][] = [
  ['ecommerce', 'E-commerce goods / E-trgovina'],
  ['gift', 'Gift / Poklon'],
  ['documents', 'Documents / Dokumenta'],
  ['b2b', 'Commercial sale of goods (B2B)'],
  ['returned', 'Returned goods / Vraćena roba'],
  ['other', 'Other / Ostalo']
];

// The values of one envelope that come from its invoice, and can be changed per envelope
export type PerShipment = 'recipient' | 'contents' | 'netWeight' | 'value' | 'totalWeight' | 'totalValue' | 'date';
export const PER_SHIPMENT_TITLES: Record<PerShipment, string> = {
  recipient: 'Primalac',
  contents: 'Opis (1)',
  netWeight: 'Neto kg (2)',
  value: 'Vrednost (3)',
  totalWeight: 'Ukupna masa kg (6)',
  totalValue: 'Ukupna vrednost (7)',
  date: 'Datum (8)'
};

// Value = items without shipping; total weight = gross weight of the invoice (net + envelope)
export function fromInvoice(invoice: InvoiceData, settings: ShippingSettings): Record<PerShipment, string> {
  const totals = invoiceTotals(invoice);
  const value = `${totals.itemsTotal.toFixed(2)} EUR`;
  return {
    recipient: (invoice.shipTo.trim() || invoice.invoiceTo).trim(),
    contents: settings.contentsTemplate.replace('{n}', String(totals.totalPieces)),
    netWeight: formatKg(totals.netWeightKg),
    value,
    totalWeight: formatKg(totals.grossWeightKg),
    totalValue: value,
    date: formatDateSr(todayIso())
  };
}

export function buildLabel(values: Record<PerShipment, string>, settings: ShippingSettings): ShippingLabel {
  return {
    ...values,
    sender: settings.sender,
    category: settings.category,
    otherText: settings.otherText,
    hsCode: settings.hsCode,
    origin: settings.origin
  };
}
