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
  // Optional overrides; when empty the invoice shows the value worked out from the fields above
  amountOverride?: number | null;  // line amount instead of quantity x unit price
  vatPercent?: string;             // "VAT Percent" column
  orderNumber?: string;            // "Broj narudžbenice / Order Number" column
  customsText?: string;            // the customs row under the item
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
  // Optional overrides of texts and totals the invoice otherwise works out itself
  shippingLabel?: string;          // "Shipping - Troškovi transporta"
  hsSummary?: string;              // HS code under the items ("9503.0090")
  originSummary?: string;          // country of origin under the items
  totalPiecesOverride?: number | null;
  netWeightOverride?: number | null;
  // Fixed texts of the layout (company details, VAT note, responsible person), by cell address
  fixedTexts?: Record<string, string>;
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
