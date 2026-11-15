import { Product } from '../types';
import { ProductIdentifiers, fetchProductIdentifiers } from './productIdentifiers';

// Product search for the header search bar and the search page. Besides the title it finds a
// product by its codes (CRC-0042, CRCP-0042, EAN) typed in any form ("crc 42", "crc0042",
// "42") and by part numbers mentioned in its description (e.g. Tamiya 47479).

let identifiersPromise: Promise<Record<string, ProductIdentifiers>> | null = null;

// Codes are loaded once per visit and shared by the search bar and the search page
export function loadProductIdentifiers() {
  identifiersPromise ??= fetchProductIdentifiers();
  return identifiersPromise;
}

const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

function codeMatches(code: string | null | undefined, query: string) {
  if (!code) return false;
  const c = compact(code);
  const q = compact(query);
  if (q.length === 0) return false;
  if (c.includes(q)) return true;
  // "42" or "crc42" finds CRC-0042: same letters, same number without the leading zeros
  const [, codeLetters, codeNumber] = /^([a-z]*)(\d+)$/.exec(c) ?? [];
  const [, queryLetters, queryNumber] = /^([a-z]*)(\d+)$/.exec(q) ?? [];
  return Boolean(codeNumber && queryNumber && (queryLetters === '' || queryLetters === codeLetters)
    && Number(codeNumber) === Number(queryNumber));
}

export function searchProducts(
  list: Product[],
  query: string,
  identifiers: Record<string, ProductIdentifiers> = {}
): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // DF01 also finds the Top Force parts it is the chassis of
  if (q === 'df01') {
    return list.filter((p) =>
      p.title.toLowerCase().includes('df01') || p.id.toLowerCase().includes('df01') ||
      p.title.toLowerCase().includes('top force') || p.id.toLowerCase().includes('top-force'));
  }

  const byName: Product[] = [];
  const byCode: Product[] = [];
  const byDescription: Product[] = [];
  for (const product of list) {
    const ids = identifiers[product.id];
    if (product.title.toLowerCase().includes(q) || product.id.toLowerCase().includes(q)) {
      byName.push(product);
    } else if (ids && [ids.merchantProductId, ids.manufacturerProductId, ids.standardProductId].some((code) => codeMatches(code, q))) {
      byCode.push(product);
    } else if (q.length >= 3 && product.description?.toLowerCase().includes(q)) {
      byDescription.push(product);
    }
  }
  return [...byName, ...byCode, ...byDescription];
}
