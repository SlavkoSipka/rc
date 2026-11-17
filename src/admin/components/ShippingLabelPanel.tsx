import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { INVOICE_DEFAULTS } from '../invoice/invoiceDefaults';
import { formatDateSr, formatKg, invoiceTotals, todayIso } from '../invoice/invoiceLogic';
import type { InvoiceData } from '../invoice/types';
import { Cn22Category, STRIPS, ShippingLabel, printShippingSheet, shippingSheetHtml } from '../shipping/shippingSheet';

// What stays the same from shipment to shipment, remembered in this browser
const STORAGE_KEY = 'admin-shipping-label';
interface Remembered {
  sender: string;
  contentsTemplate: string; // {n} = number of pieces
  category: Cn22Category;
  otherText: string;
  hsCode: string;
  origin: string;
  nextStrip: number;
}
const DEFAULTS: Remembered = {
  sender: 'Bora Company Doo\nVuka Karadžića 6\nRuđinci\n36217 Vrnjci\nSerbia',
  contentsTemplate: '{n} PCS OF MODEL TOY CAR PARTS',
  category: 'ecommerce',
  otherText: '',
  hsCode: INVOICE_DEFAULTS.hsCode,
  origin: INVOICE_DEFAULTS.countryOfOrigin,
  nextStrip: 0
};
function readRemembered(): Remembered {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Remembered>) };
  } catch {
    return DEFAULTS;
  }
}
function writeRemembered(value: Remembered) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the values are simply not remembered
  }
}

const CATEGORIES: [Cn22Category, string][] = [
  ['ecommerce', 'E-commerce goods / E-trgovina'],
  ['gift', 'Gift / Poklon'],
  ['documents', 'Documents / Dokumenta'],
  ['b2b', 'Commercial sale of goods (B2B)'],
  ['returned', 'Returned goods / Vraćena roba'],
  ['other', 'Other / Ostalo']
];

type PerShipment = 'recipient' | 'contents' | 'netWeight' | 'value' | 'totalWeight' | 'totalValue' | 'date';

const inputClass = 'w-full border rounded px-2 py-1 text-sm';

function SheetPreview({ html }: { html: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const pageW = (210 / 25.4) * 96;
  const pageH = (297 / 25.4) * 96;
  useLayoutEffect(() => {
    const update = () => wrapper.current && setScale(wrapper.current.clientWidth / pageW);
    update();
    const observer = new ResizeObserver(update);
    if (wrapper.current) observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, [pageW]);
  return (
    <div ref={wrapper} className="w-full overflow-hidden border border-gray-300 bg-white" style={{ height: pageH * scale }}>
      <iframe
        title="Pregled koverte"
        srcDoc={html}
        style={{ width: pageW, height: pageH, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  );
}

// Sender and recipient labels and the CN 22, filled in from the invoice, on one strip of a
// self-adhesive A4 sheet (three shipments per sheet). Only the signature is left to do by hand.
export function ShippingLabelPanel({ invoice }: { invoice: InvoiceData }) {
  const [saved, setSaved] = useState(readRemembered);
  const [overrides, setOverrides] = useState<Partial<Record<PerShipment, string>>>({});
  const [strip, setStrip] = useState(() => readRemembered().nextStrip % STRIPS);

  const remember = (changes: Partial<Remembered>) => {
    const next = { ...saved, ...changes };
    setSaved(next);
    writeRemembered(next);
  };

  const totals = invoiceTotals(invoice);
  const value = `${totals.itemsTotal.toFixed(2)} EUR`;
  const computed: Record<PerShipment, string> = {
    recipient: (invoice.shipTo.trim() || invoice.invoiceTo).trim(),
    contents: saved.contentsTemplate.replace('{n}', String(totals.totalPieces)),
    netWeight: formatKg(totals.netWeightKg),
    value,
    totalWeight: formatKg(totals.grossWeightKg),
    totalValue: value,
    date: formatDateSr(todayIso())
  };
  const field = (key: PerShipment) => overrides[key] ?? computed[key];
  const set = (key: PerShipment, text: string) => setOverrides((prev) => ({ ...prev, [key]: text }));

  const label: ShippingLabel = {
    sender: saved.sender,
    recipient: field('recipient'),
    category: saved.category,
    otherText: saved.otherText,
    contents: field('contents'),
    netWeight: field('netWeight'),
    value: field('value'),
    hsCode: saved.hsCode,
    origin: saved.origin,
    totalWeight: field('totalWeight'),
    totalValue: field('totalValue'),
    date: field('date')
  };
  const labelKey = JSON.stringify(label);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previewHtml = useMemo(() => shippingSheetHtml({ [strip]: label }, true), [labelKey, strip]);

  const print = () => {
    printShippingSheet({ [strip]: label });
    const next = (strip + 1) % STRIPS;
    setStrip(next);
    remember({ nextStrip: next });
  };

  const perShipment = (key: PerShipment, title: string) => (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-0.5">
        {title}
        {overrides[key] != null && (
          <button type="button" onClick={() => setOverrides(({ [key]: _, ...rest }) => rest)} className="ml-2 text-amber-700 hover:underline">
            vrati iz fakture
          </button>
        )}
      </span>
      <input value={field(key)} onChange={(e) => set(key, e.target.value)} className={`${inputClass} ${overrides[key] != null ? 'border-amber-400 bg-amber-50' : ''}`} />
    </label>
  );

  return (
    <details className="bg-white rounded-lg shadow p-4 group">
      <summary className="font-semibold cursor-pointer">Koverta: adrese i CN 22 (samolepljivi A4, 3 pošiljke po tabaku)</summary>
      <div className="mt-3 grid md:grid-cols-[minmax(0,1fr)_14rem] gap-4">
        <div className="space-y-3 min-w-0">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-gray-500 mb-0.5">Pošiljalac (pamti se)</span>
              <textarea value={saved.sender} onChange={(e) => remember({ sender: e.target.value })} rows={5} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-500 mb-0.5">
                Primalac
                {overrides.recipient != null && (
                  <button type="button" onClick={() => setOverrides(({ recipient: _, ...rest }) => rest)} className="ml-2 text-amber-700 hover:underline">
                    vrati iz fakture
                  </button>
                )}
              </span>
              <textarea value={field('recipient')} onChange={(e) => set('recipient', e.target.value)} rows={5} className={inputClass} />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-gray-500 mb-0.5">Vrsta pošiljke (pamti se)</span>
              <select value={saved.category} onChange={(e) => remember({ category: e.target.value as Cn22Category })} className={inputClass}>
                {CATEGORIES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
              </select>
            </label>
            {saved.category === 'other' && (
              <label className="block">
                <span className="block text-xs text-gray-500 mb-0.5">Ostalo — šta</span>
                <input value={saved.otherText} onChange={(e) => remember({ otherText: e.target.value })} className={inputClass} />
              </label>
            )}
          </div>

          <label className="block">
            <span className="block text-xs text-gray-500 mb-0.5">Opis sadržaja (pamti se; {'{n}'} = broj komada sa fakture)</span>
            <input value={saved.contentsTemplate} onChange={(e) => remember({ contentsTemplate: e.target.value })} className={inputClass} />
          </label>
          {perShipment('contents', 'Opis za ovu pošiljku (1)')}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {perShipment('netWeight', 'Neto kg (2)')}
            {perShipment('value', 'Vrednost (3)')}
            <label className="block">
              <span className="block text-xs text-gray-500 mb-0.5">Tarifni broj (4)</span>
              <input value={saved.hsCode} onChange={(e) => remember({ hsCode: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-500 mb-0.5">Zemlja porekla (5)</span>
              <input value={saved.origin} onChange={(e) => remember({ origin: e.target.value })} className={inputClass} />
            </label>
            {perShipment('totalWeight', 'Ukupna masa kg (6)')}
            {perShipment('totalValue', 'Ukupna vrednost (7)')}
            {perShipment('date', 'Datum (8)')}
          </div>
          <p className="text-xs text-gray-500">
            Vrednost je zbir stavki bez poštarine; ukupna masa je bruto sa fakture (neto + koverta). Sve što izmeniš
            ovde važi samo za ovu kovertu, ne menja fakturu.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="text-sm">Mesto na tabaku:</span>
            {Array.from({ length: STRIPS }, (_, i) => (
              <label key={i} className={`px-3 py-1.5 border rounded text-sm cursor-pointer ${strip === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}>
                <input type="radio" className="sr-only" checked={strip === i} onChange={() => { setStrip(i); remember({ nextStrip: i }); }} />
                {['1 (gore)', '2 (sredina)', '3 (dole)'][i]}
              </label>
            ))}
          </div>
          <button type="button" onClick={print} className="px-5 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">
            Štampaj kovertu (mesto {strip + 1})
          </button>
          <p className="text-xs text-gray-500">
            U prozoru za štampu: papir A4, razmera 100 % (ne „Fit to page“), margine „None“/„Bez“. Posle štampe
            sledeći put se samo predlaže sledeće mesto, pa isti tabak vratiš u štampač.
          </p>
        </div>
        <SheetPreview html={previewHtml} />
      </div>
    </details>
  );
}
