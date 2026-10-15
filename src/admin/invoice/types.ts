// Export invoice ("RAČUN / INVOICE", layout of BC-E-CRCP invoices issued by Bora - Company doo)

export interface InvoiceLine {
  productId: string | null;        // site product, null for a line typed by hand
  description: string;             // "Front bulkhead - Prednja glavčina" (English - Serbian, no brand names)
  unit: string;                    // "Pcs"
  quantity: number;                // invoice pieces
  unitPrice: number;               // EUR per invoice piece
  unitNetWeightKg: number | null;  // kg per invoice piece
  material: string;
  countryOfOrigin: string;
  hsCode: string;
  merchantProductId: string;       // M-PID
  manufacturerProductId: string;   // NS-PID
  standardProductId: string;       // S-PID (EAN/GTIN), '' when the product has none
  // Order lines only: what the buyer bought, so pieces and price per piece can be derived
  // (a set of 8 inserts sold for 12 EUR is invoiced as 8 Pcs x 1.50 EUR)
  orderTitle?: string;
  orderQuantity?: number;
  orderUnitPrice?: number;
  piecesPerUnit: number;
}

export interface InvoiceData {
  prefix: string;                  // "BC-E-CRCP"
  number: number;                  // 243
  year: number;                    // 2026  -> "BC-E-CRCP 243/2026"
  invoiceDate: string;             // YYYY-MM-DD
  deliveryDate: string;            // YYYY-MM-DD
  invoicePlace: string;
  deliveryPlace: string;
  transactionId: string;           // PayPal transaction ID, or the eBay order number
  paymentMethod: string;
  invoiceTo: string;               // multi-line address block
  shipTo: string;
  lines: InvoiceLine[];
  shipping: number;
  exchangeRate: number | null;     // NBS middle rate EUR -> RSD on the invoice date
  grossWeightKg: number | null;
  packaging: string;               // "1 Envelope"
  purpose: string;                 // what the goods are used for (FedEx asks for it per item)
  orderTotal: number | null;       // amount the buyer paid, to check the invoice against it
}

export interface SavedInvoice {
  id: string;
  created_at: string;
  order_id: string | null;
  prefix: string;
  number: number;
  year: number;
  invoice_date: string;
  customer_name: string | null;
  total: number | null;
  data: InvoiceData;
}
