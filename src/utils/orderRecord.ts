// Saves a paid order to Supabase (orders + order_items) right after PayPal captured the
// payment, so the admin panel can list it and issue the export invoice. Queued like the
// order email: retried until record_order succeeds (it is idempotent per PayPal order).

import { supabase } from '../lib/supabase';
import { createPendingQueue } from './pendingQueue';

export interface OrderRecord {
  paypal_order_id: string;
  paypal_capture_id: string;
  payment_status: string;
  payer_email: string;
  payer_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  country_code: string;
  currency: string;
  subtotal: number;
  shipping: number;
  total: number;
  items: { product_id: string; title: string; quantity: number; unit_price: number }[];
}

async function saveOrder(order: OrderRecord) {
  const { error } = await supabase.rpc('record_order', { p_order: order });
  if (error) throw new Error(error.message);
}

const queue = createPendingQueue<OrderRecord>('pendingOrderRecords', 'Saving order', saveOrder);

export function recordOrder(order: OrderRecord): Promise<boolean> {
  return queue.enqueue(order.paypal_order_id, order);
}

export function flushPendingOrderRecords() {
  queue.flush();
}
