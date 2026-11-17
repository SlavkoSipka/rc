// Envelope labels on self-adhesive A4: the sheet is split into three strips of 210 x 99 mm and each
// shipment takes one strip — the CN 22 customs declaration (full 74 x 105 mm, turned on its side so
// it fits the strip), the sender's address and the recipient's address. Everything is cut out with
// scissors, so a sheet serves three shipments: print on strip 1, next time on strip 2, then 3.
// Drawn as an HTML page and printed by the browser (all our letters č ć đ ž print correctly).

export type Cn22Category = 'gift' | 'documents' | 'ecommerce' | 'b2b' | 'returned' | 'other';

export interface ShippingLabel {
  sender: string;       // multi-line
  recipient: string;    // multi-line
  category: Cn22Category;
  otherText: string;    // "Other (please specify)" when category is 'other'
  contents: string;     // "4 PCS OF MODEL TOY CAR PARTS"
  netWeight: string;    // "0.036"
  value: string;        // "75.00 EUR"
  hsCode: string;       // "9503.0090"
  origin: string;       // "Serbia"
  totalWeight: string;  // "0.086"
  totalValue: string;   // "75.00 EUR"
  date: string;         // "17.11.2026"
}

export const STRIPS = 3;
const STRIP_H = 99; // 297 / 3

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const lines = (text: string) =>
  text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => `<div class="ln">${esc(l)}</div>`).join('');

const box = (checked: boolean) => `<span class="cb">${checked ? 'X' : ''}</span>`;

// The CN 22 form, 74 mm wide and 105 mm tall, as the printed one of Pošta Srbije
function cn22(label: ShippingLabel) {
  const c = label.category;
  const cat = (key: Cn22Category, en: string, sr: string) =>
    `<div class="cat">${box(c === key)}<div><b>${en}</b><br>${sr}</div></div>`;
  return `
<div class="cn22">
  <div class="r head">
    <div class="h-l"><b>CUSTOMS DECLARATION</b><br>CARINSKA DEKLARACIJA</div>
    <div class="h-r"><div><b>May be opened officially</b><br>Može se službeno otvoriti</div><div class="cn">CN 22</div></div>
  </div>
  <div class="r op">
    <div><b>Designated operator</b><br>Ovlašćeni operator<br><b>"Pošta Srbije" L.L.C.</b></div>
    <div><b>Important!</b><br>See instructions on the back<br>Važno! Videti uputstva na poleđini</div>
  </div>
  <div class="r cats">
    <div class="col">
      ${cat('gift', 'Gift (non-commercial)', 'Poklon')}
      ${cat('documents', 'Documents', 'Dokumenta')}
      ${cat('ecommerce', 'E-commerce goods', 'E-trgovina')}
    </div>
    <div class="col">
      ${cat('b2b', 'Commercial sale of goods (B2B)', 'Komercijalna prodaja robe (B2B)')}
      ${cat('returned', 'Returned goods', 'Vraćena roba')}
      <div class="cat">${box(c === 'other')}<div><b>Other (please specify):</b> <span class="fill">${c === 'other' ? esc(label.otherText) : ''}</span><br>Ostalo</div></div>
    </div>
  </div>
  <div class="r items-h">
    <div><b>Quantity and detailed description of contents (1)</b><br>Količina i detaljan opis sadržine (1)</div>
    <div><b>Net weight (2)</b><br>Neto masa (u kg) (2)</div>
    <div><b>Value and currency (3)</b><br>Vrednost i valuta (3)</div>
    <div><b>HS tariff number* (4)</b><br>Tarifni broj HS* (4)</div>
    <div><b>Country of origin* (5)</b><br>Zemlja porekla (5)</div>
  </div>
  <div class="r items">
    <div class="fill">${esc(label.contents)}</div>
    <div class="fill">${esc(label.netWeight)}</div>
    <div class="fill">${esc(label.value)}</div>
    <div class="fill">${esc(label.hsCode)}</div>
    <div class="fill">${esc(label.origin)}</div>
  </div>
  <div class="r totals">
    <div><b>Total weight (in kg) (6)</b><br>Ukupna masa (u kg) (6)<div class="fill">${esc(label.totalWeight)}</div></div>
    <div><b>Total value (7)</b><br>Ukupna vrednost (7)<div class="fill">${esc(label.totalValue)}</div></div>
  </div>
  <div class="r decl">
    <p><b>I, the undersigned, whose name and address are given on the item, certify that the particulars given in
    this declaration are correct and that this item does not contain any dangerous article or articles prohibited
    by legislation or by postal or customs regulations.</b></p>
    <p>„Svojim potpisom, kao osoba čije su ime i adresa navedeni na pošiljci, potvrđujem da su svi podaci u ovoj
    deklaraciji tačni, kao i da pošiljka ne sadrži opasne niti zakonom ili poštanskim i carinskim propisima
    zabranjene artikle.“</p>
    <div class="sign"><div><b>Date and sender's signature (8)</b><br>Datum i potpis pošiljaoca (8)</div><div class="fill date">${esc(label.date)}</div></div>
  </div>
</div>`;
}

function strip(label: ShippingLabel, index: number) {
  const top = index * STRIP_H;
  return `
<div class="strip" style="top:${top}mm">
  <div class="cn22-slot">${cn22(label)}</div>
  <div class="addr from"><div class="tag">From:</div><div class="fit" data-max="12">${lines(label.sender)}</div></div>
  <div class="addr to"><div class="tag">To:</div><div class="fit bold" data-max="17">${lines(label.recipient)}</div></div>
</div>`;
}

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #fff; break-after: page; }
.sheet:last-of-type { break-after: auto; }
.cut { position: absolute; left: 0; right: 0; border-top: 0.2mm dashed #999; }
.empty { position: absolute; left: 6mm; right: 6mm; height: 87mm; border: 0.3mm dashed #cbd5e1; border-radius: 2mm;
  display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 5mm; }
.strip { position: absolute; left: 0; width: 210mm; height: ${STRIP_H}mm; }

/* CN 22 (74 x 105 mm) turned on its side: the slot is 105 x 74 mm */
.cn22-slot { position: absolute; left: 7mm; top: 12.5mm; width: 105mm; height: 74mm; }
.cn22 { position: absolute; left: 0; top: 0; width: 74mm; height: 105mm; transform-origin: top left;
  transform: translate(0, 74mm) rotate(-90deg); border: 0.35mm solid #000; display: flex; flex-direction: column;
  font-size: 1.75mm; line-height: 1.12; }
.cn22 b { font-weight: 700; }
.r { display: flex; border-bottom: 0.25mm solid #000; }
.r > div { padding: 0.5mm 0.8mm; }
.head { height: 11mm; }
.head .h-l { width: 52%; font-size: 2.3mm; padding-top: 1.2mm; }
.head .h-r { width: 48%; display: flex; justify-content: space-between; font-size: 2.05mm; }
.head .cn { font-size: 4.4mm; font-weight: 700; white-space: nowrap; }
.op { height: 9mm; font-size: 1.95mm; }
.op > div { width: 50%; }
.cats { height: 15mm; }
.cats .col { width: 50%; padding: 0; display: flex; flex-direction: column; }
.cats .col + .col { border-left: 0.25mm solid #000; }
.cat { flex: 1; display: flex; align-items: stretch; font-size: 1.7mm; }
.cat > div { padding: 0.4mm 0.8mm; }
.cb { width: 4.2mm; flex: none; border-right: 0.25mm solid #000; border-bottom: 0.25mm solid #000; display: flex;
  align-items: center; justify-content: center; font-size: 3.6mm; font-weight: 700; }
.cat:last-child .cb { border-bottom: none; }
.items-h, .items { font-size: 1.55mm; }
.items-h { height: 10mm; }
.items { height: 21mm; }
.items-h > div, .items > div { border-left: 0.25mm solid #000; }
.items-h > div:first-child, .items > div:first-child { border-left: none; }
.items-h > div:nth-child(1), .items > div:nth-child(1) { width: 31%; }
.items-h > div:nth-child(2), .items > div:nth-child(2) { width: 13%; }
.items-h > div:nth-child(3), .items > div:nth-child(3) { width: 18%; }
.items-h > div:nth-child(4), .items > div:nth-child(4) { width: 21%; }
.items-h > div:nth-child(5), .items > div:nth-child(5) { width: 17%; }
.fill { font-family: Arial, Helvetica, sans-serif; font-weight: 700; color: #000; font-size: 2.5mm; }
.items .fill { padding-top: 1.5mm; font-size: 2.15mm; overflow-wrap: anywhere; }
.totals { height: 9.5mm; font-size: 1.75mm; }
.totals > div { width: 50%; }
.totals > div + div { border-left: 0.25mm solid #000; }
.totals .fill { margin-top: 0.6mm; }
.decl { flex: 1; border-bottom: none; flex-direction: column; padding: 0.6mm 0.8mm; font-size: 1.5mm; }
.decl p { margin: 0 0 0.6mm; text-align: justify; }
.decl > * { padding: 0 !important; }
.sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; font-size: 1.75mm; }
.sign .date { font-size: 2.8mm; }

/* Addresses, with a line above and below like the labels cut so far */
.addr { position: absolute; left: 119mm; width: 85mm; border-top: 0.35mm solid #000; border-bottom: 0.35mm solid #000;
  padding: 1.5mm 2mm; display: flex; flex-direction: column; }
.addr .tag { font-size: 3.2mm; font-weight: 700; }
.addr .fit { flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; overflow: hidden; line-height: 1.18; }
.addr .ln { white-space: nowrap; }
.addr .bold { font-weight: 700; }
.from { top: 7mm; height: 36mm; }
.to { top: 47mm; height: 45mm; }
`;

// Each address as large as it fits its box (pt)
const FIT_SCRIPT = `
document.querySelectorAll('.fit').forEach(function (el) {
  var size = Number(el.dataset.max);
  var tooBig = function () {
    if (el.scrollHeight > el.clientHeight + 1) return true;
    return Array.prototype.some.call(el.children, function (ln) { return ln.scrollWidth > el.clientWidth + 1; });
  };
  el.style.fontSize = size + 'pt';
  while (size > 6 && tooBig()) { size -= 0.5; el.style.fontSize = size + 'pt'; }
});`;

// Shipments one after another, three per A4 page. `startStrip` (0-2) is the first free strip of
// the first sheet, so a sheet already used at the top can go back in the printer. The preview
// also outlines the strips left empty and the cutting lines.
export function shippingSheetHtml(labels: ShippingLabel[], startStrip = 0, preview = false) {
  const slots: (ShippingLabel | null)[] = [...Array<null>(startStrip).fill(null), ...labels];
  const pageCount = Math.max(1, Math.ceil(slots.length / STRIPS));
  let pages = '';
  for (let page = 0; page < pageCount; page++) {
    let body = '';
    for (let i = 0; i < STRIPS; i++) {
      const label = slots[page * STRIPS + i];
      if (label) body += strip(label, i);
      else if (preview) {
        const used = page === 0 && i < startStrip;
        body += `<div class="empty" style="top:${i * STRIP_H + 6}mm">mesto ${i + 1} — ${used ? 'već iskorišćeno' : 'prazno'}</div>`;
      }
    }
    const cuts = preview ? [1, 2].map((i) => `<div class="cut" style="top:${i * STRIP_H}mm"></div>`).join('') : '';
    pages += `<div class="sheet">${cuts}${body}</div>`;
  }
  return `<!doctype html><html lang="sr"><head><meta charset="utf-8"><title>Koverte</title><style>${CSS}${preview ? 'body{background:#e5e7eb}.sheet{margin-bottom:8mm}' : ''}</style></head>
<body>${pages}<script>${FIT_SCRIPT}</script></body></html>`;
}

// Prints through a hidden frame, so no new window or popup is needed
export function printShippingSheet(labels: ShippingLabel[], startStrip = 0) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;visibility:hidden';
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  };
  frame.srcdoc = shippingSheetHtml(labels, startStrip);
  document.body.appendChild(frame);
}
