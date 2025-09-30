export const PAYPAL_CONFIG = {
  SANDBOX_CLIENT_ID: import.meta.env.VITE_PAYPAL_SANDBOX_CLIENT_ID || '',
  LIVE_CLIENT_ID: import.meta.env.VITE_PAYPAL_LIVE_CLIENT_ID || '',
  CURRENCY: 'EUR',
  INTENT: 'CAPTURE',
  MODE: import.meta.env.VITE_PAYPAL_MODE || 'live'
};