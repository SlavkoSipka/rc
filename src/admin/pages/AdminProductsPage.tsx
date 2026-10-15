import { ReactNode, useEffect, useMemo, useState } from 'react';
import { products as siteProducts } from '../../data/products';
import { outletDefectProducts } from '../../data/dataOutletDefect';
import { outletUsedProducts } from '../../data/dataOutletUsed';
import { supabase } from '../../lib/supabase';
import { MERCHANT_PRODUCT_ID_TYPE } from '../../lib/productIdentifiers';
import { ProductInvoiceData, fetchProductInvoiceData, updateProduct } from '../adminData';
import { NumberField } from '../components/NumberField';

const allSiteProducts = [...siteProducts, ...outletDefectProducts, ...outletUsedProducts];

type Draft = ProductInvoiceData & { is_new: boolean };

const FIELDS: (keyof Draft)[] = [
  'is_new', 'merchant_product_id', 'manufacturer_product_id', 'standard_product_id', 'invoice_description',
  'material', 'net_weight_kg', 'pieces_per_unit', 'country_of_origin', 'hs_code'
];

const isValidGtin = (value: string | null) => !value || /^([0-9]{8}|[0-9]{12,14})$/.test(value);
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const inputClass = 'w-full border rounded px-2 py-1 text-sm';

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="block text-xs text-gray-500 mb-0.5">{label}</span>
      {children}
    </label>
  );
}

export function AdminProductsPage() {
  const [saved, setSaved] = useState<Record<string, Draft>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const load = async () => {
    const [invoiceData, flags] = await Promise.all([
      fetchProductInvoiceData(),
      supabase.from('products').select('id, is_new')
    ]);
    if (flags.error) throw new Error(flags.error.message);
    const isNew: Record<string, boolean> = {};
    (flags.data ?? []).forEach((row: { id: string; is_new: boolean | null }) => {
      isNew[row.id] = Boolean(row.is_new);
    });
    const rows: Record<string, Draft> = {};
    Object.values(invoiceData).forEach((row) => {
      rows[row.id] = { ...row, is_new: isNew[row.id] ?? false };
    });
    setSaved(rows);
    setDrafts(JSON.parse(JSON.stringify(rows)));
  };

  useEffect(() => {
    load().catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(
    () => [...allSiteProducts].sort((a, b) => a.title.localeCompare(b.title)),
    []
  );

  const incomplete = (d: Draft | undefined) =>
    !d || !d.invoice_description || !d.material || d.net_weight_kg == null || !d.country_of_origin || !d.manufacturer_product_id;

  const visible = sorted.filter((p) => {
    const d = drafts[p.id];
    if (onlyIncomplete && !incomplete(d)) return false;
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const text = `${p.title} ${d?.merchant_product_id ?? ''} ${d?.invoice_description ?? ''}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });

  const updateDraft = (id: string, changes: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));

  const isDirty = (id: string) =>
    FIELDS.some((field) => JSON.stringify(saved[id]?.[field] ?? null) !== JSON.stringify(drafts[id]?.[field] ?? null));

  const save = async (id: string) => {
    const d = drafts[id];
    setError(null);
    if (!d.merchant_product_id?.trim() || !d.manufacturer_product_id?.trim()) {
      setError('M-PID i NS-PID su obavezni.');
      return;
    }
    if (!isValidGtin(d.standard_product_id?.trim() || null)) {
      setError('EAN / GTIN mora imati 8, 12, 13 ili 14 cifara, ili ostavi prazno ako ga proizvod nema.');
      return;
    }
    setSavingId(id);
    try {
      await updateProduct(id, {
        is_new: d.is_new,
        merchant_product_id: d.merchant_product_id.trim(),
        manufacturer_product_id: d.manufacturer_product_id.trim(),
        standard_product_id: d.standard_product_id?.trim() || null,
        invoice_description: d.invoice_description?.trim() || null,
        material: d.material?.trim() || null,
        net_weight_kg: d.net_weight_kg,
        pieces_per_unit: Math.max(1, Math.round(d.pieces_per_unit) || 1),
        country_of_origin: d.country_of_origin?.trim() || null,
        hs_code: d.hs_code?.trim() || '9503.0090'
      });
      setSaved((prev) => ({ ...prev, [id]: JSON.parse(JSON.stringify(d)) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const downloadCsv = () => {
    const header = [
      'Product', 'URL', 'M-PID (C127)', 'Product ID Type', 'NS-PID (C128)', 'S-PID (C129)',
      'Invoice description', 'Material', 'Net weight kg/pc', 'Pieces per unit', 'Country of origin', 'HS code'
    ];
    const rows = sorted.map((p) => {
      const d = saved[p.id];
      return [
        p.title, `https://customrc.parts/product/${p.id}`, d?.merchant_product_id, MERCHANT_PRODUCT_ID_TYPE,
        d?.manufacturer_product_id, d?.standard_product_id || 'NO', d?.invoice_description, d?.material,
        d?.net_weight_kg, d?.pieces_per_unit, d?.country_of_origin, d?.hs_code
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customrc-products-customs.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-gray-500">Učitavanje proizvoda…</p>;

  const incompleteCount = sorted.filter((p) => incomplete(drafts[p.id])).length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Proizvodi</h1>
      <p className="text-gray-600 text-sm max-w-3xl">
        Šifre za EU carinu (od 1.11.2026): <strong>M-PID</strong> je naša šifra proizvoda (Product ID Type: SKU),
        <strong> NS-PID</strong> šifra proizvođača, <strong>EAN</strong> barkod ako postoji (prazno = "NO").
        Opis, materijal, neto težina po komadu i komadi u pakovanju idu na izvoznu fakturu. Ako upišeš nešto
        drugačije na samoj fakturi, to se ovde zapamti.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pretraga…"
          className="border rounded px-3 py-2 text-sm w-72"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyIncomplete} onChange={(e) => setOnlyIncomplete(e.target.checked)} />
          Samo nepotpuni ({incompleteCount})
        </label>
        <button onClick={downloadCsv} className="ml-auto px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm">
          Preuzmi CSV (šifre i carinski podaci)
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {Object.keys(saved).length === 0 ? (
        <p className="text-amber-700">Nema podataka iz baze. Proveri da su obe SQL migracije puštene.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => {
            const d = drafts[p.id];
            if (!d) return null;
            return (
              <div key={p.id} className={`bg-white rounded-lg shadow p-3 space-y-2 ${incomplete(d) ? 'border-l-4 border-amber-400' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{p.title}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-1 text-sm text-gray-600">
                      <input type="checkbox" checked={d.is_new} onChange={(e) => updateDraft(p.id, { is_new: e.target.checked })} />
                      New
                    </label>
                    <button
                      onClick={() => save(p.id)}
                      disabled={!isDirty(p.id) || savingId === p.id}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      {savingId === p.id ? 'Čuvanje…' : 'Sačuvaj'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
                  <Field label="M-PID" className="md:col-span-2">
                    <input value={d.merchant_product_id ?? ''} onChange={(e) => updateDraft(p.id, { merchant_product_id: e.target.value })} className={`${inputClass} font-mono`} />
                  </Field>
                  <Field label="NS-PID" className="md:col-span-2">
                    <input value={d.manufacturer_product_id ?? ''} onChange={(e) => updateDraft(p.id, { manufacturer_product_id: e.target.value })} className={`${inputClass} font-mono`} />
                  </Field>
                  <Field label="EAN / GTIN" className="md:col-span-2">
                    <input value={d.standard_product_id ?? ''} onChange={(e) => updateDraft(p.id, { standard_product_id: e.target.value })} placeholder="NO" className={`${inputClass} font-mono`} />
                  </Field>
                  <Field label="Opis na fakturi (EN - SR)" className="col-span-2 md:col-span-6">
                    <input value={d.invoice_description ?? ''} onChange={(e) => updateDraft(p.id, { invoice_description: e.target.value })} className={inputClass} />
                  </Field>
                  <Field label="Materijal" className="col-span-2 md:col-span-4">
                    <input value={d.material ?? ''} onChange={(e) => updateDraft(p.id, { material: e.target.value })} className={inputClass} />
                  </Field>
                  <Field label="Neto kg/kom" className="md:col-span-2">
                    <NumberField value={d.net_weight_kg} onChange={(v) => updateDraft(p.id, { net_weight_kg: v })} placeholder="kg" />
                  </Field>
                  <Field label="Kom. u pakovanju" className="md:col-span-2">
                    <NumberField value={d.pieces_per_unit} onChange={(v) => updateDraft(p.id, { pieces_per_unit: v ?? 1 })} />
                  </Field>
                  <Field label="Zemlja porekla" className="md:col-span-2">
                    <input value={d.country_of_origin ?? ''} onChange={(e) => updateDraft(p.id, { country_of_origin: e.target.value })} className={inputClass} />
                  </Field>
                  <Field label="HS kod" className="md:col-span-2">
                    <input value={d.hs_code ?? ''} onChange={(e) => updateDraft(p.id, { hs_code: e.target.value })} className={inputClass} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
