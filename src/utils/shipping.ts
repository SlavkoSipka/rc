/**
 * Single source of truth for shipping costs.
 *
 * The shop prices and charges in EUR (see PAYPAL_CONFIG.CURRENCY), so the
 * $30 flat rate for the United States is stored as a fixed EUR conversion
 * rather than converted at runtime: 30 USD x 0.863349 = 25.90 EUR
 * (rate taken on 2026-09-03). Update US_SHIPPING_EUR when the rate is
 * refreshed so the checkout total never depends on a live FX call.
 */
export const US_SHIPPING_USD = 30;
export const USD_TO_EUR_RATE = 0.863349;

/** Flat rate to the United States, regardless of quantity. */
export const US_SHIPPING_EUR = 25.90;

/** Rest of the world: first item, then a surcharge per additional item. */
export const BASE_SHIPPING_EUR = 8.50;
export const EXTRA_ITEM_SHIPPING_EUR = 2;

/** Country name as stored by the checkout form. */
export const US_COUNTRY = 'United States';

/** Country the cart assumes before the buyer picks one at checkout. */
export const DEFAULT_COUNTRY = US_COUNTRY;

const US_ALIASES = [
  'united states',
  'united states of america',
  'usa',
  'us'
];

export function isUnitedStates(country?: string): boolean {
  if (!country) return false;
  return US_ALIASES.includes(country.trim().toLowerCase());
}

/**
 * Shipping cost in EUR for a given basket size and destination.
 * United States is a flat rate; everywhere else scales with quantity.
 */
export function calculateShipping(totalQuantity: number, country?: string): number {
  if (totalQuantity <= 0) return 0;
  if (isUnitedStates(country)) return US_SHIPPING_EUR;
  return BASE_SHIPPING_EUR + Math.max(0, totalQuantity - 1) * EXTRA_ITEM_SHIPPING_EUR;
}

const STORAGE_KEY = 'shippingCountry';

/** Remember the checkout country so the cart panel shows the same rate. */
export function storeShippingCountry(country: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, country);
  } catch {
    // Storage can be unavailable (private mode); the default rate still applies.
  }
}

export function readShippingCountry(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}
