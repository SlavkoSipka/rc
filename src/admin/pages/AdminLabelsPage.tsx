import { useEffect, useMemo, useState } from 'react';
import { products as siteProducts } from '../../data/products';
import { outletDefectProducts } from '../../data/dataOutletDefect';
import { outletUsedProducts } from '../../data/dataOutletUsed';
import { ProductInvoiceData, fetchProductInvoiceData } from '../adminData';
import { NumberField } from '../components/NumberField';
import { isCode128Encodable } from '../labels/code128';
import { LABEL_H, LABEL_W, PartLabel, labelSvg, labelsPdf } from '../labels/partLabel';
import { todayIso } from '../invoice/invoiceLogic';

const allSiteProducts = [...siteProducts, ...outletDefectProducts, ...outletUsedProducts];
const siteById = Object.fromEntries(allSiteProducts.map((p) => [p.id, p]));

const inputClass = 'w-full border rounded px-2 py-1 text-sm';

// Texts changed on a label are remembered per product in this browser, for the next print
const STORAGE_KEY = 'admin-label-texts';
type SavedTexts = Record<string, { name: string; detail: string }>;
function readSavedTexts(): SavedTexts {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as SavedTexts;
  } catch {
    return {};
  }
}
function writeSavedTexts(texts: SavedTexts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(texts));
  } catch {
    // Private window or storage blocked: the texts are simply not remembered
  }
}

interface Row extends PartLabel {
  productId: string;
  quantity: number;
}

// The models a part fits, from the product title: everything before the first word for
// material or colour. "Tamiya TRF201, 211, 201 XMW Aluminium silver ..." -> "Tamiya TRF201, 211, 201 XMW"
const MATERIAL_OR_COLOUR =
  /\s+(?:Aluminium|Aluminum|Alu|Brass|POM|Delrin|Steel|Stainless|Carbon|Titanium|Black|White|Blue|Red|Silver|Gold|Green|Orange|Purple|Pink|Yellow|Grey|Gray|Dark|Light|Hard|Anodized|CNC)\b.*$/i;
function fitsModels(title: string) {
  const models = title.replace(MATERIAL_OR_COLOUR, '').replace(/[\s,\-–]+$/, '');
  return models.split(/\s+/).length > 1 ? models : title;
}

// "Hinge pin brace - Spona vešanja" + Silver -> "Hinge pin brace · Silver", and the models it fits
function defaultTexts(product: ProductInvoiceData) {
  const site = siteById[product.id];
  const title = site?.title ?? product.title ?? product.id;
  const english = product.invoice_description?.split(' - ')[0]?.trim();
  return english
    ? { name: [english, site?.color].filter(Boolean).join(' · '), detail: fitsModels(title) }
    : { name: title, detail: '' };
}

function LabelPreview({ label }: { label: PartLabel }) {
  const svg = useMemo(() => {
    try {
      return labelSvg(label);
    } catch {
      return null;
    }
  }, [label]);
  if (!svg) return <p className="text-xs text-red-600">Šifra ne može u bar kod.</p>;
  return (
    <img
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
      alt={label.code}
      className="w-full max-w-md border border-gray-300 rounded-sm bg-white"
      style={{ aspectRatio: `${LABEL_W} / ${LABEL_H}` }}
    />
  );
}

export function AdminLabelsPage() {
  const [products, setProducts] = useState<Record<string, ProductInvoiceData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetchProductInvoiceData()
      .then(setProducts)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return Object.values(products)
      .filter((p) => {
        const text = `${siteById[p.id]?.title ?? p.title ?? ''} ${p.merchant_product_id ?? ''}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .sort((a, b) => (a.merchant_product_id ?? '').localeCompare(b.merchant_product_id ?? ''))
      .slice(0, 12);
  }, [query, products]);

  const add = (product: ProductInvoiceData) => {
    const code = product.merchant_product_id?.trim();
    if (!code) return;
    const existing = rows.findIndex((r) => r.productId === product.id);
    if (existing >= 0) {
      setRows(rows.map((r, i) => (i === existing ? { ...r, quantity: r.quantity + 1 } : r)));
      return;
    }
    const texts = readSavedTexts()[product.id] ?? defaultTexts(product);
    setRows([...rows, { productId: product.id, code, ...texts, quantity: 1 }]);
  };

  const update = (index: number, changes: Partial<Row>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...changes } : r));
    setRows(next);
    if ('name' in changes || 'detail' in changes) {
      const row = next[index];
      writeSavedTexts({ ...readSavedTexts(), [row.productId]: { name: row.name, detail: row.detail } });
    }
  };

  const resetTexts = (index: number) => {
    const row = rows[index];
    const saved = readSavedTexts();
    delete saved[row.productId];
    writeSavedTexts(saved);
    const product = products[row.productId];
    if (product) update(index, defaultTexts(product));
  };

  const total = rows.reduce((sum, r) => sum + r.quantity, 0);

  const download = () => {
    const labels = rows.flatMap((r) => Array.from({ length: r.quantity }, () => ({ code: r.code, name: r.name, detail: r.detail })));
    const url = URL.createObjectURL(labelsPdf(labels));
    const link = document.createElement('a');
    link.href = url;
    link.download = `nalepnice-${todayIso()}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading) return <p className="text-gray-500">Učitavanje proizvoda…</p>;

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Nalepnice za kartice</h1>
      <p className="text-sm text-gray-600">
        Nalepnica {LABEL_W} × {LABEL_H} mm koja se lepi na belo polje kartice: šifra, naziv, jedan red više i bar kod
        šifre. Izaberi proizvode i koliko komada, pa preuzmi PDF: svaka nalepnica je jedna strana {LABEL_W} × {LABEL_H} mm,
        za štampač nalepnica sa rolnom od 62 mm.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Dodaj proizvod: kucaj naziv ili CRC-šifru…"
          className="w-full border rounded px-3 py-2 text-sm"
        />
        {matches.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded shadow divide-y">
            {matches.map((p) => {
              const code = p.merchant_product_id?.trim();
              const usable = Boolean(code && isCode128Encodable(code));
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!usable}
                  onClick={() => {
                    add(p);
                    setQuery('');
                  }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50 disabled:text-gray-400 disabled:hover:bg-white"
                >
                  <span className="font-mono text-gray-500 mr-2">{code || 'nema šifre'}</span>
                  {siteById[p.id]?.title ?? p.title ?? p.id}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Još nijedan proizvod nije izabran.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.productId} className="bg-white rounded-lg shadow p-3 space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-mono font-semibold mr-2">{row.code}</span>
                  <span className="text-gray-500">{siteById[row.productId]?.title ?? row.productId}</span>
                </span>
                <button onClick={() => setRows(rows.filter((_, i) => i !== index))} className="text-red-600 hover:underline shrink-0">
                  Ukloni
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_6rem] gap-2">
                <label className="block">
                  <span className="block text-xs text-gray-500 mb-0.5">Naziv (2. red)</span>
                  <input value={row.name} onChange={(e) => update(index, { name: e.target.value })} className={inputClass} />
                </label>
                <label className="block">
                  <span className="block text-xs text-gray-500 mb-0.5">3. red (sivo, može prazno)</span>
                  <input value={row.detail} onChange={(e) => update(index, { detail: e.target.value })} className={inputClass} />
                </label>
                <label className="block">
                  <span className="block text-xs text-gray-500 mb-0.5">Komada</span>
                  <NumberField value={row.quantity} onChange={(v) => update(index, { quantity: Math.max(1, Math.round(v ?? 1)) })} />
                </label>
              </div>
              <div className="flex items-end gap-3">
                <LabelPreview label={row} />
                <button type="button" onClick={() => resetTexts(index)} className="text-xs text-gray-500 hover:underline shrink-0">
                  vrati podrazumevani tekst
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4">
            <button onClick={download} className="px-5 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">
              Preuzmi PDF ({total} kom.)
            </button>
            <button onClick={() => setRows([])} className="text-sm text-gray-600 hover:underline">Očisti sve</button>
          </div>
        </div>
      )}
    </div>
  );
}
