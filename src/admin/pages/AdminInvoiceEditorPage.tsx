import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { products as siteProducts } from '../../data/products';
import { outletDefectProducts } from '../../data/dataOutletDefect';
import { outletUsedProducts } from '../../data/dataOutletUsed';
import {
  AdminOrder,
  DEMO_INVOICE_PREFIX,
  ProductInvoiceData,
  deleteOrder,
  isDemoOrder,
  fetchInvoice,
  fetchLatestFixedTexts,
  fetchOrder,
  fetchProductInvoiceData,
  rememberInvoiceLines,
  saveInvoice
} from '../adminData';
import { NumberField } from '../components/NumberField';
import {
  blankInvoice,
  customerName,
  fetchNbsEurRate,
  formatDateSr,
  invoiceFromOrder,
  invoiceNumberText,
  invoiceProblems,
  invoiceTotals,
  lineFromProduct,
  formatKg,
  suggestInvoiceNumber,
  withPiecesPerUnit
} from '../invoice/invoiceLogic';
import { downloadInvoiceXlsx } from '../invoice/invoiceXlsx';
import {
  DEFAULT_SHIPPING_LABEL,
  EDITABLE_FIXED_TEXTS,
  customsText,
  defaultHsSummary,
  defaultOriginSummary,
  templateText
} from '../invoice/invoiceSheet';
import { InvoicePreview } from '../components/InvoicePreview';
import type { InvoiceData, InvoiceLine } from '../invoice/types';

const siteTitles: Record<string, string> = Object.fromEntries(
  [...siteProducts, ...outletDefectProducts, ...outletUsedProducts].map((p) => [p.id, p.title])
);

const inputClass = 'w-full border rounded px-2 py-1 text-sm';

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="block text-xs text-gray-500 mb-0.5">{label}</span>
      {children}
    </label>
  );
}

// A value the invoice works out itself unless one is typed in. A typed value stays until it is
// cleared, so it is framed in amber with a button back to the worked-out value.
function AutoNumberField({ value, computed, onChange }: { value: number | null; computed: string; onChange: (v: number | null) => void }) {
  const manual = value != null;
  return (
    <div className="flex gap-1">
      <NumberField
        value={value}
        onChange={onChange}
        placeholder={computed}
        className={`w-full border rounded px-2 py-1 text-sm ${manual ? 'border-amber-400 bg-amber-50' : ''}`}
      />
      {manual && (
        <button type="button" onClick={() => onChange(null)} title={`Vrati izračunato (${computed})`} className="px-1.5 border rounded text-xs text-amber-800 whitespace-nowrap">
          auto
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-lg shadow p-4 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function OrderSummary({ order }: { order: AdminOrder }) {
  return (
    <Section title="Porudžbina sa sajta">
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <p><span className="text-gray-500">Datum:</span> {new Date(order.created_at).toLocaleString('sr-RS')}</p>
        <p><span className="text-gray-500">PayPal transakcija:</span> {order.paypal_capture_id || '-'} ({order.payment_status || '?'})</p>
        <p><span className="text-gray-500">Kupac:</span> {[order.first_name, order.last_name].join(' ')}</p>
        <p><span className="text-gray-500">PayPal nalog:</span> {order.payer_name} · {order.payer_email}</p>
        <p><span className="text-gray-500">Telefon:</span> {order.phone || '-'}</p>
        <p><span className="text-gray-500">PayPal order ID:</span> {order.paypal_order_id}</p>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {order.order_items.map((item) => (
            <tr key={item.id}>
              <td className="py-1">{item.title}</td>
              <td className="py-1 text-gray-500 whitespace-nowrap">{item.merchant_product_id}</td>
              <td className="py-1 text-right whitespace-nowrap">{item.quantity} × €{Number(item.unit_price).toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-1 text-gray-500" colSpan={2}>Dostava</td>
            <td className="py-1 text-right">€{Number(order.shipping).toFixed(2)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="py-1" colSpan={2}>Uplaćeno</td>
            <td className="py-1 text-right">€{Number(order.total).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

function LineEditor({
  line,
  index,
  purpose,
  onChange,
  onRemove
}: {
  line: InvoiceLine;
  index: number;
  purpose: string;
  onChange: (line: InvoiceLine) => void;
  onRemove: () => void;
}) {
  const update = (changes: Partial<InvoiceLine>) => onChange({ ...line, ...changes });
  const fromOrder = line.orderQuantity != null;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">Stavka {index + 1}</span>
          {fromOrder && (
            <span className="text-gray-500">
              {' '}· kupljeno: {line.orderTitle} — {line.orderQuantity} × €{line.orderUnitPrice?.toFixed(2)}
            </span>
          )}
          {!fromOrder && line.productId && (
            <span className="text-gray-500"> · {siteTitles[line.productId] ?? line.productId}</span>
          )}
        </div>
        <button onClick={onRemove} className="text-sm text-red-600 hover:underline shrink-0">Ukloni</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
        <Field label="Opis (engleski - srpski)" className="col-span-2 md:col-span-12">
          <input value={line.description} onChange={(e) => update({ description: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Jedinica" className="md:col-span-2">
          <input value={line.unit} onChange={(e) => update({ unit: e.target.value })} className={inputClass} />
        </Field>
        {fromOrder && (
          <Field label="Kom. u pak." className="md:col-span-2">
            <NumberField value={line.piecesPerUnit} onChange={(v) => onChange(withPiecesPerUnit(line, v ?? 1))} />
          </Field>
        )}
        <Field label="Količina" className="md:col-span-2">
          <NumberField value={line.quantity} onChange={(v) => update({ quantity: v ?? 0 })} />
        </Field>
        <Field label="Cena/kom €" className={fromOrder ? 'md:col-span-2' : 'md:col-span-3'}>
          <NumberField value={line.unitPrice} onChange={(v) => update({ unitPrice: v ?? 0 })} />
        </Field>
        <Field label="Neto kg/kom" className="md:col-span-2">
          <NumberField
            value={line.unitNetWeightKg}
            onChange={(v) => update({ unitNetWeightKg: v })}
            placeholder="kg"
          />
        </Field>
        <Field label="Iznos €" className={fromOrder ? 'md:col-span-2' : 'md:col-span-3'}>
          <AutoNumberField
            value={line.amountOverride ?? null}
            onChange={(v) => update({ amountOverride: v })}
            computed={(line.quantity * line.unitPrice).toFixed(2)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
        <Field label="Materijal" className="col-span-2 md:col-span-6">
          <input value={line.material} onChange={(e) => update({ material: e.target.value })} className={inputClass} placeholder="Aluminium 6082, anodized" />
        </Field>
        <Field label="Zemlja porekla" className="md:col-span-3">
          <input value={line.countryOfOrigin} onChange={(e) => update({ countryOfOrigin: e.target.value })} className={inputClass} />
        </Field>
        <Field label="HS kod" className="md:col-span-3">
          <input value={line.hsCode} onChange={(e) => update({ hsCode: e.target.value })} className={inputClass} />
        </Field>
        <Field label="M-PID (SKU)" className="md:col-span-4">
          <input value={line.merchantProductId} onChange={(e) => update({ merchantProductId: e.target.value })} className={`${inputClass} font-mono`} />
        </Field>
        <Field label="NS-PID" className="md:col-span-4">
          <input value={line.manufacturerProductId} onChange={(e) => update({ manufacturerProductId: e.target.value })} className={`${inputClass} font-mono`} />
        </Field>
        <Field label="EAN / S-PID" className="md:col-span-4">
          <input value={line.standardProductId} onChange={(e) => update({ standardProductId: e.target.value })} className={`${inputClass} font-mono`} placeholder="NO" />
        </Field>
        <Field label="PDV %" className="md:col-span-4">
          <input value={line.vatPercent ?? ''} onChange={(e) => update({ vatPercent: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Broj narudžbenice" className="md:col-span-8">
          <input value={line.orderNumber ?? ''} onChange={(e) => update({ orderNumber: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Carinski red ispod stavke (prazno = sam se sastavi iz polja iznad)" className="col-span-2 md:col-span-12">
          <textarea
            rows={2}
            value={line.customsText ?? ''}
            onChange={(e) => update({ customsText: e.target.value })}
            placeholder={customsText(line, purpose)}
            className={`${inputClass} text-xs`}
          />
        </Field>
      </div>
    </div>
  );
}

function ProductPicker({
  products,
  onPick
}: {
  products: Record<string, ProductInvoiceData>;
  onPick: (product: ProductInvoiceData) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return Object.values(products)
      .filter((p) => {
        const text = `${siteTitles[p.id] ?? p.title ?? ''} ${p.merchant_product_id ?? ''}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .slice(0, 8);
  }, [query, products]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Dodaj proizvod: kucaj naziv ili CRC-šifru…"
        className={inputClass}
      />
      {matches.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded shadow divide-y">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onPick(p);
                setQuery('');
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
            >
              <span className="font-mono text-gray-500 mr-2">{p.merchant_product_id}</span>
              {siteTitles[p.id] ?? p.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminInvoiceEditorPage() {
  const { orderId: orderParam, invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [savedId, setSavedId] = useState<string | undefined>(undefined);
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [products, setProducts] = useState<Record<string, ProductInvoiceData>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);

  const isNewInvoice = invoiceId === 'new';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const catalog = await fetchProductInvoiceData();
      let draft: InvoiceData;
      let existingId: string | undefined;
      let loadedOrder: AdminOrder | null = null;

      if (orderParam) {
        loadedOrder = await fetchOrder(orderParam);
        const existing = loadedOrder.invoices[0];
        if (existing) {
          const saved = await fetchInvoice(existing.id);
          draft = saved.data;
          existingId = saved.id;
        } else {
          draft = invoiceFromOrder(loadedOrder, catalog);
        }
      } else if (invoiceId && !isNewInvoice) {
        const saved = await fetchInvoice(invoiceId);
        draft = saved.data;
        existingId = saved.id;
        if (saved.order_id) loadedOrder = await fetchOrder(saved.order_id);
      } else {
        draft = blankInvoice();
      }

      if (!existingId) {
        // A practice invoice gets its own series so the real numbering is not used up
        if (loadedOrder && isDemoOrder(loadedOrder)) draft = { ...draft, prefix: DEMO_INVOICE_PREFIX };
        draft = { ...draft, number: await suggestInvoiceNumber(draft.prefix, draft.year) };
        draft.exchangeRate = await fetchNbsEurRate(draft.invoiceDate);
        // Company details and notes as they were changed on the last invoice
        const fixedTexts = await fetchLatestFixedTexts();
        if (fixedTexts) draft.fixedTexts = fixedTexts;
      }
      if (cancelled) return;
      setProducts(catalog);
      setOrder(loadedOrder);
      setSavedId(existingId);
      setInvoice(draft);
    };
    setInvoice(null);
    setError(null);
    setMessage(null);
    load().catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [orderParam, invoiceId, isNewInvoice]);

  const problems = useMemo(() => (invoice ? invoiceProblems(invoice) : []), [invoice]);

  if (error) return <p className="text-red-600">Greška: {error}</p>;
  if (!invoice) return <p className="text-gray-500">Učitavanje…</p>;

  const totals = invoiceTotals(invoice);
  const update = (changes: Partial<InvoiceData>) => setInvoice((prev) => (prev ? { ...prev, ...changes } : prev));
  const updateLine = (index: number, line: InvoiceLine) =>
    update({ lines: invoice.lines.map((l, i) => (i === index ? line : l)) });

  const loadRate = async (date: string) => {
    setRateLoading(true);
    const rate = await fetchNbsEurRate(date);
    setRateLoading(false);
    if (rate) update({ exchangeRate: rate });
    else setMessage('Kurs NBS nije učitan, upiši ga ručno.');
  };

  const changeInvoiceDate = (date: string) => {
    const year = Number(date.slice(0, 4));
    update({ invoiceDate: date, deliveryDate: date, year: year || invoice.year });
    if (date) void loadRate(date);
  };

  const nextNumber = async () => {
    update({ number: await suggestInvoiceNumber(invoice.prefix.trim(), invoice.year) });
  };

  const addProduct = (product: ProductInvoiceData) => {
    const line = lineFromProduct(product, { productId: product.id, title: siteTitles[product.id] ?? product.title ?? product.id });
    update({ lines: [...invoice.lines, line] });
  };

  const addBlankLine = () => {
    update({ lines: [...invoice.lines, lineFromProduct(undefined, { productId: null, title: '' })] });
  };

  const save = async () => {
    setMessage(null);
    const blocking = problems.filter((p) => /Broj fakture|Kupac|nijednu stavku/.test(p));
    if (blocking.length > 0) {
      setMessage(blocking.join(' '));
      return;
    }
    if (problems.length > 0 && !window.confirm(`Faktura ima upozorenja:\n\n- ${problems.join('\n- ')}\n\nSačuvati i preuzeti svejedno?`)) {
      return;
    }
    setSaving(true);
    try {
      const final = { ...invoice, prefix: invoice.prefix.trim() };
      const id = await saveInvoice(final, {
        id: savedId,
        orderId: order?.id ?? null,
        customerName: customerName(final),
        total: totals.total
      });
      try {
        await rememberInvoiceLines(final.lines);
      } catch (e) {
        console.error('Remembering invoice data on products failed:', e);
      }
      await downloadInvoiceXlsx(final);
      setSavedId(id);
      setMessage(`Faktura ${invoiceNumberText(final)} je sačuvana i preuzeta.`);
      if (!orderParam && isNewInvoice) navigate(`/admin/invoices/${id}`, { replace: true });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">
            {savedId ? `Faktura ${invoiceNumberText(invoice)}` : 'Nova faktura'}
          </h1>
          {order && <Link to="/admin/orders" className="text-sm text-blue-600 hover:underline">← porudžbine</Link>}
        </div>

        {order && isDemoOrder(order) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-2">
            <p>
              <strong>Ovo je PRIMER porudžbine</strong>, da vidiš kako ide faktura. Nije prava kupovina. Faktura
              dobija seriju „PRIMER“, pa pravi brojevi (BC-E-CRCP 244, 245…) ostaju netaknuti.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('Obrisati primer porudžbinu i njenu fakturu?')) return;
                try {
                  await deleteOrder(order.id);
                  navigate('/admin/orders');
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
              className="text-red-700 underline"
            >
              Obriši primer kad završiš
            </button>
          </div>
        )}

        {order && <OrderSummary order={order} />}

        <Section title="Zaglavlje">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <Field label="Serija" className="md:col-span-2">
              <input value={invoice.prefix} onChange={(e) => update({ prefix: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Broj">
              <div className="flex gap-1">
                <NumberField value={invoice.number} onChange={(v) => update({ number: Math.max(0, Math.round(v ?? 0)) })} />
                {!savedId && (
                  <button type="button" onClick={nextNumber} title="Sledeći slobodan broj" className="px-2 border rounded text-sm">↻</button>
                )}
              </div>
            </Field>
            <Field label="Godina">
              <NumberField value={invoice.year} onChange={(v) => update({ year: Math.round(v ?? invoice.year) })} />
            </Field>
            <Field label="Datum fakture">
              <input type="date" value={invoice.invoiceDate} onChange={(e) => changeInvoiceDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Datum prometa">
              <input type="date" value={invoice.deliveryDate} onChange={(e) => update({ deliveryDate: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Broj transakcije (PayPal / eBay order)" className="col-span-2 md:col-span-3">
              <input value={invoice.transactionId} onChange={(e) => update({ transactionId: e.target.value })} className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Način plaćanja" className="md:col-span-2">
              <input value={invoice.paymentMethod} onChange={(e) => update({ paymentMethod: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Mesto izdavanja / prometa">
              <input
                value={invoice.invoicePlace}
                onChange={(e) => update({ invoicePlace: e.target.value, deliveryPlace: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-sm text-gray-600">Broj na fakturi: <strong>{invoiceNumberText(invoice)}</strong></p>
        </Section>

        <Section title="Kupac">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Primalac računa (Invoice to)">
              <textarea
                rows={5}
                value={invoice.invoiceTo}
                onChange={(e) => {
                  const sameAsBefore = invoice.shipTo === invoice.invoiceTo;
                  update({ invoiceTo: e.target.value, ...(sameAsBefore ? { shipTo: e.target.value } : {}) });
                }}
                className={inputClass}
              />
            </Field>
            <Field label="Primalac isporuke (Ship to)">
              <textarea rows={5} value={invoice.shipTo} onChange={(e) => update({ shipTo: e.target.value })} className={inputClass} />
            </Field>
          </div>
        </Section>

        <Section title="Stavke">
          <p className="text-sm text-gray-600">
            Ono što ovde upišeš (opis, materijal, težina, komadi u pakovanju, poreklo) zapamti se za taj
            proizvod i sledeći put se popuni samo.
          </p>
          {invoice.lines.map((line, index) => (
            <LineEditor
              key={index}
              line={line}
              index={index}
              purpose={invoice.purpose}
              onChange={(next) => updateLine(index, next)}
              onRemove={() => update({ lines: invoice.lines.filter((_, i) => i !== index) })}
            />
          ))}
          <div className="grid md:grid-cols-[1fr_auto] gap-2">
            <ProductPicker products={products} onPick={addProduct} />
            <button type="button" onClick={addBlankLine} className="px-3 py-1 border rounded text-sm hover:bg-gray-50">
              + Prazna stavka
            </button>
          </div>
        </Section>

        <Section title="Dostava, težina i kurs">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <Field label="Dostava (EUR)">
              <NumberField value={invoice.shipping} onChange={(v) => update({ shipping: v ?? 0 })} />
            </Field>
            <Field label="Bruto težina (kg)">
              <AutoNumberField
                value={invoice.grossWeightKg}
                onChange={(v) => update({ grossWeightKg: v })}
                computed={formatKg(invoiceTotals({ ...invoice, grossWeightKg: null }).grossWeightKg)}
              />
            </Field>
            <Field label="Pakovanje (Collet)">
              <input value={invoice.packaging} onChange={(e) => update({ packaging: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Namena robe (za carinu)" className="md:col-span-3">
              <input value={invoice.purpose} onChange={(e) => update({ purpose: e.target.value })} className={inputClass} />
            </Field>
            <Field label={`Srednji kurs NBS na ${formatDateSr(invoice.invoiceDate)}`} className="md:col-span-2">
              <div className="flex gap-1">
                <NumberField value={invoice.exchangeRate} onChange={(v) => update({ exchangeRate: v })} />
                <button type="button" onClick={() => loadRate(invoice.invoiceDate)} className="px-2 border rounded text-sm whitespace-nowrap">
                  {rateLoading ? '…' : 'Učitaj'}
                </button>
              </div>
            </Field>
            <Field label="Tekst za dostavu" className="col-span-2 md:col-span-4">
              <input
                value={invoice.shippingLabel ?? ''}
                onChange={(e) => update({ shippingLabel: e.target.value })}
                placeholder={DEFAULT_SHIPPING_LABEL}
                className={inputClass}
              />
            </Field>
            <Field label="HS kod (dole)" className="md:col-span-2">
              <input value={invoice.hsSummary ?? ''} onChange={(e) => update({ hsSummary: e.target.value })} placeholder={defaultHsSummary(invoice)} className={inputClass} />
            </Field>
            <Field label="Zemlja porekla (dole)" className="md:col-span-2">
              <input value={invoice.originSummary ?? ''} onChange={(e) => update({ originSummary: e.target.value })} placeholder={defaultOriginSummary(invoice)} className={inputClass} />
            </Field>
            <Field label="Ukupno komada">
              <AutoNumberField
                value={invoice.totalPiecesOverride ?? null}
                onChange={(v) => update({ totalPiecesOverride: v })}
                computed={String(invoiceTotals({ ...invoice, totalPiecesOverride: null }).totalPieces)}
              />
            </Field>
            <Field label="Ukupno neto (kg)">
              <AutoNumberField
                value={invoice.netWeightOverride ?? null}
                onChange={(v) => update({ netWeightOverride: v })}
                computed={formatKg(invoiceTotals({ ...invoice, netWeightOverride: null }).netWeightKg)}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-500">Siva polja su izračunata sama i menjaju se sa stavkama. Kad upišeš svoju vrednost, polje postane žuto i više se ne menja samo; „auto“ ga vraća na izračunato.</p>
        </Section>

        <details className="bg-white rounded-lg shadow p-4">
          <summary className="font-semibold cursor-pointer">Podaci firme i fiksni tekstovi</summary>
          <p className="text-xs text-gray-500 mt-2">Izmene ovde se pamte i za sledeće fakture.</p>
          <div className="grid md:grid-cols-2 gap-2 mt-3">
            {EDITABLE_FIXED_TEXTS.map(({ address, label }) => (
              <Field key={address} label={label}>
                <input
                  value={invoice.fixedTexts?.[address] ?? templateText(address)}
                  onChange={(e) => update({ fixedTexts: { ...(invoice.fixedTexts ?? {}), [address]: e.target.value } })}
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
        </details>

        <section className="bg-white rounded-lg shadow p-4 space-y-3 sticky bottom-2">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <span>Ukupno komada: <strong>{totals.totalPieces}</strong></span>
            <span>Neto: <strong>{formatKg(totals.netWeightKg)} kg</strong>{invoice.netWeightOverride != null && ' (ručno)'}</span>
            <span>Bruto: <strong>{formatKg(totals.grossWeightKg)} kg</strong>{invoice.grossWeightKg != null && ' (ručno)'}</span>
            <span>Ukupno: <strong>€{totals.total.toFixed(2)}</strong></span>
            {invoice.orderTotal != null && (
              // Prices may be changed on purpose, so a different total is only shown, not a warning
              <span className={Math.abs(invoice.orderTotal - totals.total) > 0.005 ? 'text-gray-500' : undefined}>
                Uplaćeno: <strong>€{invoice.orderTotal.toFixed(2)}</strong>
                {Math.abs(invoice.orderTotal - totals.total) > 0.005 && ' (razlikuje se od fakture)'}
              </span>
            )}
            {totals.totalRsd != null && <span>RSD: <strong>{totals.totalRsd.toFixed(2)}</strong></span>}
          </div>
          {problems.length > 0 && (
            <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 list-disc pl-6">
              {problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          {message && <p className="text-sm text-blue-800">{message}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Čuvanje…' : savedId ? 'Sačuvaj izmene i preuzmi Excel' : 'Sačuvaj i preuzmi Excel'}
          </button>
        </section>
      </div>

      <aside className="xl:sticky xl:top-4 space-y-2">
        <h2 className="font-semibold text-sm text-gray-600">Pregled: ovako izgleda odštampano (menja se dok kucaš)</h2>
        <div className="bg-white rounded-lg shadow p-3">
          <InvoicePreview invoice={invoice} />
        </div>
      </aside>
    </div>
  );
}
