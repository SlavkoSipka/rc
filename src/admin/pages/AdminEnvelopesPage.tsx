import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchInvoices } from '../adminData';
import { formatDateSr, invoiceNumberText } from '../invoice/invoiceLogic';
import type { SavedInvoice } from '../invoice/types';
import { Cn22Category, STRIPS, printShippingSheet, shippingSheetHtml } from '../shipping/shippingSheet';
import {
  CN22_CATEGORIES,
  PER_SHIPMENT_TITLES,
  PerShipment,
  ShippingSettings,
  buildLabel,
  fromInvoice,
  readShippingSettings,
  writeShippingSettings
} from '../shipping/shippingSettings';

const inputClass = 'w-full border rounded px-2 py-1 text-sm';
const STRIP_NAMES = ['1 (gore)', '2 (sredina)', '3 (dole)'];

function SheetPreview({ html }: { html: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.4);
  const [pageH, setPageH] = useState((297 / 25.4) * 96);
  const pageW = (210 / 25.4) * 96;
  useLayoutEffect(() => {
    const update = () => wrapper.current && setScale(wrapper.current.clientWidth / pageW);
    update();
    const observer = new ResizeObserver(update);
    if (wrapper.current) observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, [pageW]);
  return (
    <div ref={wrapper} className="w-full overflow-hidden border border-gray-300 bg-gray-200" style={{ height: pageH * scale }}>
      <iframe
        ref={frame}
        title="Pregled koverti"
        srcDoc={html}
        onLoad={() => setPageH(frame.current?.contentDocument?.body.scrollHeight ?? pageH)}
        style={{ width: pageW, height: pageH, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  );
}

// Envelope labels for several invoices at once: sender, recipient and CN 22 for each, three
// shipments per self-adhesive A4 sheet. Only the signature is left to do by hand.
export function AdminEnvelopesPage() {
  const [params] = useSearchParams();
  const [invoices, setInvoices] = useState<SavedInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ShippingSettings>(readShippingSettings);
  const [selected, setSelected] = useState<string[]>(() => (params.get('invoice') ? [params.get('invoice') as string] : []));
  const [overrides, setOverrides] = useState<Record<string, Partial<Record<PerShipment, string>>>>({});
  const [start, setStart] = useState(() => readShippingSettings().nextStrip % STRIPS);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices().then(setInvoices).catch((e: Error) => setError(e.message));
  }, []);

  const remember = (changes: Partial<ShippingSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      writeShippingSettings(next);
      return next;
    });
  };

  const byId = useMemo(() => Object.fromEntries((invoices ?? []).map((i) => [i.id, i])), [invoices]);
  const printed = useMemo(() => new Set(settings.printed), [settings.printed]);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = (invoices ?? []).filter((i) => {
      const text = `${invoiceNumberText(i)} ${i.customer_name ?? ''} ${i.data.shipTo}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
    return showAll || words.length > 0 ? list : list.slice(0, 25);
  }, [invoices, query, showAll]);

  const valuesOf = (id: string) => {
    const computed = fromInvoice(byId[id].data, settings);
    return { ...computed, ...overrides[id] };
  };
  const shipments = selected.filter((id) => byId[id]);
  const labels = shipments.map((id) => buildLabel(valuesOf(id), settings));
  const labelsKey = JSON.stringify(labels);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previewHtml = useMemo(() => shippingSheetHtml(labels, start, true), [labelsKey, start]);
  const sheets = Math.ceil((start + shipments.length) / STRIPS);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const print = () => {
    printShippingSheet(labels, start);
    const next = (start + shipments.length) % STRIPS;
    remember({ nextStrip: next, printed: [...settings.printed.filter((id) => !shipments.includes(id)), ...shipments] });
    setStart(next);
    setMessage(
      `Poslato na štampu: ${shipments.length} kov. Sledeći put tabak kreće od mesta ${STRIP_NAMES[next]}` +
        (next === 0 ? ' (nov tabak).' : ' — vrati isti tabak u štampač.')
    );
    setSelected([]);
    setOverrides({});
  };

  if (error) return <p className="text-red-600">Greška: {error}</p>;
  if (!invoices) return <p className="text-gray-500">Učitavanje faktura…</p>;

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_26rem] gap-6 items-start">
      <div className="space-y-4 min-w-0">
        <div>
          <h1 className="text-2xl font-bold">Koverte: adrese i CN 22</h1>
          <p className="text-sm text-gray-600">
            Štikliraj fakture za pakete koje šalješ. Svaka dobija svoju traku na samolepljivom A4 (CN 22, From i To),
            tri po tabaku, redom kako ih štikliraš. Masa, količina i vrednost su sa fakture; ostaje samo potpis.
          </p>
        </div>

        <section className="bg-white rounded-lg shadow">
          <div className="p-3 border-b flex flex-wrap gap-3 items-center">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Traži: broj fakture, kupac, grad…" className="flex-1 min-w-[12rem] border rounded px-3 py-1.5 text-sm" />
            {!showAll && !query && invoices.length > 25 && (
              <button onClick={() => setShowAll(true)} className="text-sm text-blue-600 hover:underline">prikaži sve ({invoices.length})</button>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Nema faktura.</p>
          ) : (
            <div className="divide-y max-h-[22rem] overflow-y-auto">
              {shown.map((invoice) => {
                const position = selected.indexOf(invoice.id);
                return (
                  <label key={invoice.id} className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${position >= 0 ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={position >= 0} onChange={() => toggle(invoice.id)} />
                    <span className="w-5 text-center font-bold text-blue-700">{position >= 0 ? position + 1 : ''}</span>
                    <span className="w-40 font-medium">{invoiceNumberText(invoice)}</span>
                    <span className="w-20 text-gray-500">{formatDateSr(invoice.invoice_date)}</span>
                    <span className="flex-1 truncate">
                      {invoice.customer_name}
                      <span className="text-gray-500"> · {invoice.data.shipTo.split('\n').filter(Boolean).slice(-1)[0]}</span>
                    </span>
                    {printed.has(invoice.id) && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800">odštampano</span>}
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {shipments.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Izabrano ({shipments.length}) — po potrebi izmeni pre štampe</h2>
            {shipments.map((id, index) => {
              const values = valuesOf(id);
              const changed = overrides[id] ?? {};
              const set = (key: PerShipment, text: string) =>
                setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], [key]: text } }));
              return (
                <details key={id} className="bg-white rounded-lg shadow px-3 py-2">
                  <summary className="cursor-pointer text-sm flex flex-wrap gap-x-4">
                    <span className="font-bold text-blue-700">{index + 1}.</span>
                    <span className="font-medium">{invoiceNumberText(byId[id])}</span>
                    <span>{values.recipient.split('\n')[0]}</span>
                    <span className="text-gray-500">{values.contents} · {values.netWeight} kg · {values.value}</span>
                    {Object.keys(changed).length > 0 && <span className="text-amber-700">izmenjeno</span>}
                  </summary>
                  <div className="grid sm:grid-cols-2 gap-3 mt-2 pb-1">
                    <label className="block sm:row-span-3">
                      <span className="block text-xs text-gray-500 mb-0.5">{PER_SHIPMENT_TITLES.recipient}</span>
                      <textarea value={values.recipient} onChange={(e) => set('recipient', e.target.value)} rows={6} className={`${inputClass} ${changed.recipient != null ? 'border-amber-400 bg-amber-50' : ''}`} />
                    </label>
                    {(['contents', 'netWeight', 'value', 'totalWeight', 'totalValue', 'date'] as PerShipment[]).map((key) => (
                      <label key={key} className="block">
                        <span className="block text-xs text-gray-500 mb-0.5">{PER_SHIPMENT_TITLES[key]}</span>
                        <input value={values[key]} onChange={(e) => set(key, e.target.value)} className={`${inputClass} ${changed[key] != null ? 'border-amber-400 bg-amber-50' : ''}`} />
                      </label>
                    ))}
                    {Object.keys(changed).length > 0 && (
                      <button type="button" onClick={() => setOverrides(({ [id]: _, ...rest }) => rest)} className="text-xs text-amber-700 hover:underline text-left">
                        vrati sve sa fakture
                      </button>
                    )}
                  </div>
                </details>
              );
            })}
          </section>
        )}

        <section className="bg-white rounded-lg shadow p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Tabak u štampaču: prvo slobodno mesto</span>
            {STRIP_NAMES.map((name, i) => (
              <button key={name} type="button" onClick={() => { setStart(i); remember({ nextStrip: i }); }}
                className={`px-3 py-1.5 border rounded text-sm ${start === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}>
                {name}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Ako je od prošlog puta ostao tabak sa iskorišćenim gornjim delom, admin to pamti i nastavlja od prvog
            slobodnog mesta. Za nov tabak izaberi 1.
          </p>
          {message && <p className="text-sm text-green-800">{message}</p>}
          <button type="button" onClick={print} disabled={shipments.length === 0}
            className="px-5 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-300">
            {shipments.length === 0 ? 'Štikliraj bar jednu fakturu' : `Štampaj ${shipments.length} kov. (${sheets} ${sheets === 1 ? 'tabak' : 'tabaka'})`}
          </button>
          <p className="text-xs text-gray-500">
            U prozoru za štampu: papir A4, razmera 100 % (ne „Fit to page“), margine „None“/„Bez“.
          </p>
        </section>

        <details className="bg-white rounded-lg shadow p-4">
          <summary className="font-semibold cursor-pointer">Stalni podaci (pošiljalac, vrsta pošiljke, tarifni broj…)</summary>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <label className="block sm:row-span-2">
              <span className="block text-xs text-gray-500 mb-0.5">Pošiljalac</span>
              <textarea value={settings.sender} onChange={(e) => remember({ sender: e.target.value })} rows={5} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-500 mb-0.5">Vrsta pošiljke</span>
              <select value={settings.category} onChange={(e) => remember({ category: e.target.value as Cn22Category })} className={inputClass}>
                {CN22_CATEGORIES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
              </select>
            </label>
            {settings.category === 'other' ? (
              <label className="block">
                <span className="block text-xs text-gray-500 mb-0.5">Ostalo — šta</span>
                <input value={settings.otherText} onChange={(e) => remember({ otherText: e.target.value })} className={inputClass} />
              </label>
            ) : <div />}
            <label className="block sm:col-span-2">
              <span className="block text-xs text-gray-500 mb-0.5">Opis sadržaja ({'{n}'} = broj komada sa fakture)</span>
              <input value={settings.contentsTemplate} onChange={(e) => remember({ contentsTemplate: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-500 mb-0.5">Tarifni broj (4)</span>
              <input value={settings.hsCode} onChange={(e) => remember({ hsCode: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-500 mb-0.5">Zemlja porekla (5)</span>
              <input value={settings.origin} onChange={(e) => remember({ origin: e.target.value })} className={inputClass} />
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Vrednost (3) i ukupna vrednost (7) = ukupno sa fakture, sa poštarinom; ukupna masa = bruto sa fakture (neto + koverta). Pamti se u ovom pregledaču.
          </p>
        </details>
      </div>

      <aside className="xl:sticky xl:top-4 space-y-2">
        <h2 className="font-semibold text-sm text-gray-600">Pregled tabaka</h2>
        <SheetPreview html={previewHtml} />
      </aside>
    </div>
  );
}
