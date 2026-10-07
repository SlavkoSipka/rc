import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { products } from '../data/products';
import { outletDefectProducts } from '../data/dataOutletDefect';
import { outletUsedProducts } from '../data/dataOutletUsed';
import { supabase } from '../lib/supabase';
import { fetchProductIdentifiers, ProductIdentifiers } from '../lib/productIdentifiers';

const allProducts = [...products, ...outletDefectProducts, ...outletUsedProducts];

interface IdentifierDraft {
  merchantProductId: string;
  manufacturerProductId: string;
  standardProductId: string;
}

const toDraft = (ids: ProductIdentifiers): IdentifierDraft => ({
  merchantProductId: ids.merchantProductId,
  manufacturerProductId: ids.manufacturerProductId,
  standardProductId: ids.standardProductId ?? ''
});

const isValidGtin = (value: string) => value === '' || /^([0-9]{8}|[0-9]{12,14})$/.test(value);

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

export function AdminProductsPage() {
  const [secret, setSecret] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggleId, setToggleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identifiers, setIdentifiers] = useState<Record<string, ProductIdentifiers>>({});
  const [drafts, setDrafts] = useState<Record<string, IdentifierDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadFlags = async () => {
    const { data, error: fetchError } = await supabase
      .from('products')
      .select('id, is_new');
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    const map: Record<string, boolean> = {};
    (data ?? []).forEach((row: { id: string; is_new: boolean | null }) => {
      map[row.id] = Boolean(row.is_new);
    });
    setFlags(map);
  };

  const loadIdentifiers = async () => {
    const result = await fetchProductIdentifiers();
    setIdentifiers(result);
    const nextDrafts: Record<string, IdentifierDraft> = {};
    Object.entries(result).forEach(([id, ids]) => {
      nextDrafts[id] = toDraft(ids);
    });
    setDrafts(nextDrafts);
  };

  useEffect(() => {
    Promise.all([loadFlags(), loadIdentifiers()]).finally(() => setLoading(false));
  }, []);

  const tryUnlock = async () => {
    setError(null);
    if (!secret.trim()) {
      setError('Enter the admin secret.');
      return;
    }
    const { data, error: rpcError } = await supabase.rpc('verify_product_admin_secret', {
      p_secret: secret.trim()
    });
    if (rpcError || !data) {
      setError('Invalid secret or RPC not deployed. Apply migration and set app_config in Supabase.');
      setUnlocked(false);
      return;
    }
    setUnlocked(true);
  };

  const toggle = async (id: string, next: boolean) => {
    setError(null);
    setToggleId(id);
    const { error: rpcError } = await supabase.rpc('set_product_is_new', {
      p_id: id,
      p_is_new: next,
      p_secret: secret.trim()
    });
    setToggleId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setFlags((prev) => ({ ...prev, [id]: next }));
  };

  const updateDraft = (id: string, field: keyof IdentifierDraft, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const isDirty = (id: string) => {
    const saved = identifiers[id];
    const draft = drafts[id];
    if (!saved || !draft) return false;
    const original = toDraft(saved);
    return (Object.keys(original) as (keyof IdentifierDraft)[]).some((k) => original[k] !== draft[k].trim());
  };

  const saveIdentifiers = async (id: string) => {
    const draft = drafts[id];
    setError(null);
    if (!draft.merchantProductId.trim() || !draft.manufacturerProductId.trim()) {
      setError('M-PID and NS-PID are both required.');
      return;
    }
    if (!isValidGtin(draft.standardProductId.trim())) {
      setError('EAN / GTIN must be 8, 12, 13 or 14 digits, or empty if the product has none.');
      return;
    }
    setSavingId(id);
    const { error: rpcError } = await supabase.rpc('set_product_identifiers', {
      p_id: id,
      p_merchant_product_id: draft.merchantProductId,
      p_manufacturer_product_id: draft.manufacturerProductId,
      p_standard_product_id: draft.standardProductId,
      p_secret: secret.trim()
    });
    setSavingId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await loadIdentifiers();
  };

  const downloadCsv = () => {
    const header = ['Product', 'URL', 'M-PID (C127)', 'NS-PID (C128)', 'S-PID (C129)', 'S-PID code'];
    const rows = sorted.map((p) => {
      const ids = identifiers[p.id];
      return [
        p.title,
        `https://customrc.parts/product/${p.id}`,
        ids?.merchantProductId ?? '',
        ids?.manufacturerProductId ?? '',
        ids?.standardProductId ?? '',
        ids?.standardProductIdType ?? ''
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customrc-product-identifiers.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const sorted = [...allProducts].sort((a, b) => a.title.localeCompare(b.title));
  const hasIdentifiers = Object.keys(identifiers).length > 0;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-2xl font-bold mb-2">Products</h1>
          <p className="text-gray-600 mb-6">
            Toggle “New” for the home page. Secret must match{' '}
            <code className="font-mono text-sm bg-gray-200 px-1 rounded">app_config.product_is_new_secret</code>{' '}
            in Supabase (default <code className="font-mono text-sm">changeme</code>).
          </p>
          <p className="text-gray-600 mb-6">
            EU customs product identifiers (required from 1 November 2026): <strong>M-PID</strong> is our
            product code (C127), <strong>NS-PID</strong> the manufacturer's part number (C128),{' '}
            <strong>EAN / GTIN</strong> the barcode (C129) - leave it empty when the product has none,
            customs then gets code Y081.
          </p>

          <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
            <label className="block text-sm font-medium text-gray-700">Admin secret</label>
            <div className="flex gap-2 flex-wrap">
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="flex-1 min-w-[200px] border rounded px-3 py-2"
                placeholder="Same as in Supabase app_config"
              />
              <button
                type="button"
                onClick={tryUnlock}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Unlock editing
              </button>
            </div>
            {unlocked && <p className="text-sm text-green-700">Editing enabled for this session.</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {!loading && !hasIdentifiers && (
            <p className="mb-6 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              Product identifiers not found. Run the migration{' '}
              <code className="font-mono">20261008120000_product_identifiers.sql</code> in Supabase.
            </p>
          )}

          {hasIdentifiers && (
            <div className="mb-6">
              <button
                type="button"
                onClick={downloadCsv}
                className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
              >
                Download identifiers (CSV)
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="bg-white rounded-lg shadow divide-y overflow-hidden">
              {sorted.map((p) => (
                <div key={p.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-800 line-clamp-2">{p.title}</span>
                    <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                      <span className="text-sm text-gray-500">New</span>
                      <input
                        type="checkbox"
                        checked={flags[p.id] ?? false}
                        disabled={!unlocked || toggleId === p.id}
                        onChange={(e) => toggle(p.id, e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                  {drafts[p.id] && (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                      {([
                        ['merchantProductId', 'M-PID (C127)'],
                        ['manufacturerProductId', 'NS-PID (C128)'],
                        ['standardProductId', 'EAN / GTIN (C129)']
                      ] as [keyof IdentifierDraft, string][]).map(([field, label]) => (
                        <label key={field} className="block">
                          <span className="block text-xs text-gray-500 mb-0.5">{label}</span>
                          <input
                            type="text"
                            value={drafts[p.id][field]}
                            disabled={!unlocked}
                            onChange={(e) => updateDraft(p.id, field, e.target.value)}
                            placeholder={field === 'standardProductId' ? 'none (Y081)' : undefined}
                            className="w-full border rounded px-2 py-1 text-sm font-mono disabled:bg-gray-100"
                          />
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() => saveIdentifiers(p.id)}
                        disabled={!unlocked || !isDirty(p.id) || savingId === p.id}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                      >
                        {savingId === p.id ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
