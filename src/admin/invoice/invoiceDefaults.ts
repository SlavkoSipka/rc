// What stays the same on every export invoice. Company details, the VAT exemption note and
// the signature block are part of the layout itself (exportInvoiceTemplate.json).

export const INVOICE_DEFAULTS = {
  prefix: 'BC-E-CRCP',
  place: 'Vrnjačka banja',
  paymentMethod: 'Paypal - Payoneer',
  unit: 'Pcs',
  hsCode: '9503.0090',
  countryOfOrigin: 'Serbia',
  purpose: 'spare part for RC model car',
  packaging: '1 Envelope',
  // Envelope and padding added to the net weight for the suggested gross weight
  packagingWeightKg: 0.05
};

// Last invoice number issued before invoices were made in the admin panel, per series.
// The next one suggested is this + 1, unless a higher number was already saved.
export const LAST_INVOICE_NUMBER_BEFORE_ADMIN: Record<string, number> = {
  'BC-E-CRCP/2026': 243
};

// Country names as they are written on the invoices
export const INVOICE_COUNTRY_NAMES: Record<string, string> = {
  US: 'United States of America'
};
