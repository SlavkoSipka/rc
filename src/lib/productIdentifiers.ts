import { supabase } from './supabase';

// EU customs product identifiers (from 1 November 2026), see
// supabase/migrations/20261008120000_product_identifiers.sql
export interface ProductIdentifiers {
  merchantProductId: string;            // M-PID, TARIC C127
  manufacturerProductId: string;        // NS-PID, TARIC C128
  standardProductId: string | null;     // S-PID (GTIN/EAN/UPC), TARIC C129
  standardProductIdType: 'C129' | 'Y081'; // Y081 = product has no standard barcode
}

interface IdentifierRow {
  id: string;
  merchant_product_id: string | null;
  manufacturer_product_id: string | null;
  standard_product_id: string | null;
  standard_product_id_type: 'C129' | 'Y081' | null;
}

// Returns identifiers keyed by product id, for the given products or (no argument) all of
// them. Never throws: a missing column or a network error only means the identifiers are
// left out, checkout and product pages keep working.
export async function fetchProductIdentifiers(productIds?: string[]): Promise<Record<string, ProductIdentifiers>> {
  if (productIds && productIds.length === 0) return {};
  try {
    let query = supabase
      .from('products')
      .select('id, merchant_product_id, manufacturer_product_id, standard_product_id, standard_product_id_type');
    if (productIds) query = query.in('id', productIds);
    const { data, error } = await query;
    if (error) {
      console.error('Failed to load product identifiers:', error);
      return {};
    }
    const result: Record<string, ProductIdentifiers> = {};
    (data as IdentifierRow[] ?? []).forEach((row) => {
      if (!row.merchant_product_id) return;
      result[row.id] = {
        merchantProductId: row.merchant_product_id,
        manufacturerProductId: row.manufacturer_product_id ?? '',
        standardProductId: row.standard_product_id,
        standardProductIdType: row.standard_product_id_type ?? (row.standard_product_id ? 'C129' : 'Y081')
      };
    });
    return result;
  } catch (error) {
    console.error('Failed to load product identifiers:', error);
    return {};
  }
}

// Product ID Type of our M-PID, as FedEx asks for it next to the Merchant Product ID
export const MERCHANT_PRODUCT_ID_TYPE = 'SKU';

// One line per item for the order email / commercial invoice, in the order and wording FedEx
// asks for: M-PID, NS-PID, S-PID, with "NO" when the product has no standard barcode
export function formatIdentifiersForCustoms(ids: Pick<ProductIdentifiers, 'merchantProductId' | 'manufacturerProductId' | 'standardProductId'> | undefined): string {
  if (!ids) return 'Product IDs: not available';
  return [
    `M-PID: ${ids.merchantProductId} (${MERCHANT_PRODUCT_ID_TYPE})`,
    `NS-PID: ${ids.manufacturerProductId || '-'}`,
    `S-PID: ${ids.standardProductId || 'NO'}`
  ].join(' | ');
}
