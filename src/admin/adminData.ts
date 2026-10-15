// Supabase reads and writes of the admin panel. Every table used here is readable and
// writable only by admins (is_admin(), see migration 20261015120000_orders_invoices_admin.sql).

import { supabase } from '../lib/supabase';
import type { InvoiceData, InvoiceLine, SavedInvoice } from './invoice/types';

export interface AdminOrderItem {
  id: number;
  position: number;
  product_id: string | null;
  title: string;
  quantity: number;
  unit_price: number;
  merchant_product_id: string | null;
  manufacturer_product_id: string | null;
  standard_product_id: string | null;
}

export interface AdminOrder {
  id: string;
  created_at: string;
  source: string;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  payment_status: string | null;
  payer_email: string | null;
  payer_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  country_code: string | null;
  currency: string;
  subtotal: number;
  shipping: number;
  total: number;
  notes: string | null;
  order_items: AdminOrderItem[];
  invoices: { id: string; prefix: string; number: number; year: number }[];
}

export interface ProductInvoiceData {
  id: string;
  title: string | null;
  invoice_description: string | null;
  material: string | null;
  net_weight_kg: number | null;
  pieces_per_unit: number;
  country_of_origin: string | null;
  hs_code: string;
  merchant_product_id: string | null;
  manufacturer_product_id: string | null;
  standard_product_id: string | null;
}

const ORDER_SELECT = '*, order_items(*), invoices(id, prefix, number, year)';

// Practice order for trying the panel out: saved like a real one, marked by its PayPal order id
export const DEMO_ORDER_PREFIX = 'PRIMER-';
export const DEMO_INVOICE_PREFIX = 'PRIMER';
export const isDemoOrder = (order: Pick<AdminOrder, 'paypal_order_id'>) =>
  Boolean(order.paypal_order_id?.startsWith(DEMO_ORDER_PREFIX));

export async function deleteOrder(id: string) {
  const invoices = await supabase.from('invoices').delete().eq('order_id', id);
  if (invoices.error) throw new Error(invoices.error.message);
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Orders that still need an invoice, for the badge in the admin menu
export async function countOrdersWithoutInvoice(): Promise<number> {
  const { data, error } = await supabase.from('orders').select('id, invoices(id)');
  if (error) return 0;
  return (data ?? []).filter((order: { invoices: unknown[] }) => order.invoices.length === 0).length;
}

export async function fetchOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminOrder[];
}

export async function fetchOrder(id: string): Promise<AdminOrder> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).single();
  if (error) throw new Error(error.message);
  const order = data as AdminOrder;
  order.order_items.sort((a, b) => a.position - b.position);
  return order;
}

const PRODUCT_INVOICE_SELECT =
  'id, title, invoice_description, material, net_weight_kg, pieces_per_unit, country_of_origin, hs_code, ' +
  'merchant_product_id, manufacturer_product_id, standard_product_id';

export async function fetchProductInvoiceData(ids?: string[]): Promise<Record<string, ProductInvoiceData>> {
  let query = supabase.from('products').select(PRODUCT_INVOICE_SELECT);
  if (ids) {
    if (ids.length === 0) return {};
    query = query.in('id', ids);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const result: Record<string, ProductInvoiceData> = {};
  ((data ?? []) as unknown as ProductInvoiceData[]).forEach((row) => {
    result[row.id] = row;
  });
  return result;
}

export async function updateProduct(id: string, changes: Partial<ProductInvoiceData> & { is_new?: boolean }) {
  const { error } = await supabase.from('products').update(changes).eq('id', id);
  if (error) throw new Error(error.message);
}

// Remembers what was written on an invoice line as the product's default for the next invoice
export async function rememberInvoiceLines(lines: InvoiceLine[]) {
  const updates = lines
    .filter((line) => line.productId)
    .map((line) =>
      updateProduct(line.productId as string, {
        invoice_description: line.description.trim() || null,
        material: line.material.trim() || null,
        net_weight_kg: line.unitNetWeightKg,
        pieces_per_unit: Math.max(1, Math.round(line.piecesPerUnit) || 1),
        country_of_origin: line.countryOfOrigin.trim() || null,
        hs_code: line.hsCode.trim() || '9503.0090'
      })
    );
  await Promise.all(updates);
}

export async function fetchInvoices(): Promise<SavedInvoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('year', { ascending: false })
    .order('number', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedInvoice[];
}

export async function fetchInvoice(id: string): Promise<SavedInvoice> {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data as SavedInvoice;
}

// Company details / notes as edited on the most recent invoice, used for the next one
export async function fetchLatestFixedTexts(): Promise<Record<string, string> | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('data')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return null;
  return (data?.[0]?.data as InvoiceData | undefined)?.fixedTexts ?? null;
}

export async function highestInvoiceNumber(prefix: string, year: number): Promise<number> {
  const { data, error } = await supabase
    .from('invoices')
    .select('number')
    .eq('prefix', prefix)
    .eq('year', year)
    .order('number', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.number ?? 0;
}

// Inserts a new invoice or updates the existing one (id given). Returns the invoice id.
export async function saveInvoice(
  invoice: InvoiceData,
  meta: { id?: string; orderId: string | null; customerName: string; total: number }
): Promise<string> {
  const row = {
    order_id: meta.orderId,
    prefix: invoice.prefix.trim(),
    number: invoice.number,
    year: invoice.year,
    invoice_date: invoice.invoiceDate,
    customer_name: meta.customerName,
    total: meta.total,
    data: invoice
  };
  const request = meta.id
    ? supabase.from('invoices').update(row).eq('id', meta.id).select('id').single()
    : supabase.from('invoices').insert(row).select('id').single();
  const { data, error } = await request;
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Faktura ${row.prefix} ${row.number}/${row.year} već postoji. Promeni broj fakture.`);
    }
    throw new Error(error.message);
  }
  return data.id as string;
}
