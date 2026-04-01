export function formatPrice(price: number): string {
  return price.toFixed(2);
}

/**
 * Sum of (rounded discounted unit price × quantity) per line.
 * Matches PayPal's ITEM_TOTAL check (must equal sum of unit_amount × quantity).
 */
export function sumDiscountedLineTotals(
  items: { currentPrice?: number; price: number; quantity: number }[],
  applyDiscount: (price: number) => number
): number {
  return items.reduce((total, item) => {
    const base = item.currentPrice ?? item.price;
    const unit = parseFloat(applyDiscount(base).toFixed(2));
    return total + unit * item.quantity;
  }, 0);
}
