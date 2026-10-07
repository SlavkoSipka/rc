// Order notification email (EmailJS), sent from the buyer's browser right after
// PayPal captures the payment. There is no server in between, so every order email
// is first saved to localStorage and only removed once EmailJS confirms it was sent.
// Anything still pending (tab closed, network drop, EmailJS outage) is retried with
// the next page load on this site.

const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send';
const SERVICE_ID = 'service_fhgz9k5';
const TEMPLATE_ID = 'template_19flt1j';
const PUBLIC_KEY = 'Gc6J4VIypmQDaGtLS';

const STORAGE_KEY = 'pendingOrderEmails';
const RETRY_DELAYS_MS = [0, 2000, 5000];

export type OrderEmailParams = Record<string, string>;

type PendingEmails = Record<string, OrderEmailParams>;

// Orders being sent in this tab right now, so a flush never sends the same one twice
const inFlight = new Set<string>();

function readPending(): PendingEmails {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writePending(pending: PendingEmails) {
  try {
    if (Object.keys(pending).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    }
  } catch {
    // Storage unavailable (private mode, quota) - the email is still sent below
  }
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function postToEmailJS(params: OrderEmailParams, keepalive: boolean) {
  const response = await fetch(EMAILJS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: PUBLIC_KEY,
      template_params: params
    }),
    // keepalive lets the request finish even if the buyer closes the tab mid-send
    keepalive
  });
  if (!response.ok) {
    throw new Error(`EmailJS ${response.status}: ${await response.text()}`);
  }
}

async function sendWithRetry(orderId: string, params: OrderEmailParams): Promise<boolean> {
  if (inFlight.has(orderId)) return false;
  inFlight.add(orderId);
  try {
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      await wait(RETRY_DELAYS_MS[attempt]);
      try {
        // Older browsers reject keepalive on requests that need a CORS preflight,
        // so only the first attempt uses it
        await postToEmailJS(params, attempt === 0);
        const pending = readPending();
        delete pending[orderId];
        writePending(pending);
        return true;
      } catch (error) {
        console.error(`Order email for ${orderId} failed (attempt ${attempt + 1}):`, error);
      }
    }
    return false;
  } finally {
    inFlight.delete(orderId);
  }
}

export function sendOrderEmail(orderId: string, params: OrderEmailParams): Promise<boolean> {
  writePending({ ...readPending(), [orderId]: params });
  return sendWithRetry(orderId, params);
}

export function flushPendingOrderEmails() {
  const pending = readPending();
  for (const [orderId, params] of Object.entries(pending)) {
    void sendWithRetry(orderId, params);
  }
}
