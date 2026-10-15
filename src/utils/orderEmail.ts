// Order notification email (EmailJS), sent from the buyer's browser right after
// PayPal captures the payment. Queued so a failed send is retried (see pendingQueue).

import { createPendingQueue } from './pendingQueue';

const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send';
const SERVICE_ID = 'service_fhgz9k5';
const TEMPLATE_ID = 'template_19flt1j';
const PUBLIC_KEY = 'Gc6J4VIypmQDaGtLS';

export type OrderEmailParams = Record<string, string>;

async function postToEmailJS(params: OrderEmailParams, attempt: number) {
  const response = await fetch(EMAILJS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: PUBLIC_KEY,
      template_params: params
    }),
    // keepalive lets the request finish even if the buyer closes the tab mid-send. Older
    // browsers reject keepalive on requests that need a CORS preflight, so only the first
    // attempt uses it
    keepalive: attempt === 0
  });
  if (!response.ok) {
    throw new Error(`EmailJS ${response.status}: ${await response.text()}`);
  }
}

const queue = createPendingQueue<OrderEmailParams>('pendingOrderEmails', 'Order email', postToEmailJS);

export function sendOrderEmail(orderId: string, params: OrderEmailParams): Promise<boolean> {
  return queue.enqueue(orderId, params);
}

export function flushPendingOrderEmails() {
  queue.flush();
}
