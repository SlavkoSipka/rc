import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { products } from '../data/products';
import { supabase } from '../lib/supabase';

export function AdminProductsPage() {
  const [secret, setSecret] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggleId, setToggleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadFlags().finally(() => setLoading(false));
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

  const sorted = [...products].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-2xl font-bold mb-2">Product flags</h1>
          <p className="text-gray-600 mb-6">
            Toggle “New” for the home page. Secret must match{' '}
            <code className="font-mono text-sm bg-gray-200 px-1 rounded">app_config.product_is_new_secret</code>{' '}
            in Supabase (default <code className="font-mono text-sm">changeme</code>).
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
                Unlock toggles
              </button>
            </div>
            {unlocked && <p className="text-sm text-green-700">Toggles enabled for this session.</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="bg-white rounded-lg shadow divide-y overflow-hidden">
              {sorted.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
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
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
