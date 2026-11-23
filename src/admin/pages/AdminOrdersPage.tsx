import { MouseEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminOrder, deleteOrder, fetchOrders, isDemoOrder, setOrderArchived } from '../adminData';
import { invoiceNumberText } from '../invoice/invoiceLogic';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const customer = (order: AdminOrder) => [order.first_name, order.last_name].filter(Boolean).join(' ') || order.payer_name || 'kupac';

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'done'>('active');

  useEffect(() => {
    fetchOrders().then(setOrders).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">Greška: {error}</p>;
  if (!orders) return <p className="text-gray-500">Učitavanje porudžbina…</p>;

  const active = orders.filter((o) => !o.archived);
  const done = orders.filter((o) => o.archived);
  const shown = tab === 'active' ? active : done;

  // The row is a link: the buttons inside it must not open the order
  const act = (e: MouseEvent, run: () => Promise<void>) => {
    e.preventDefault();
    e.stopPropagation();
    setMessage(null);
    run()
      .then(() => window.dispatchEvent(new Event('admin-orders-changed')))
      .catch((err: Error) => setMessage(err.message));
  };

  const archive = (order: AdminOrder, archived: boolean) => async () => {
    await setOrderArchived(order.id, archived);
    setOrders((list) => list && list.map((o) => (o.id === order.id ? { ...o, archived } : o)));
  };

  const remove = (order: AdminOrder) => async () => {
    if (!window.confirm(`Obrisati porudžbinu (${customer(order)}, €${Number(order.total).toFixed(2)})?\n\nBriše se zauvek, ne može da se vrati.`)) return;
    await deleteOrder(order.id);
    setOrders((list) => list && list.filter((o) => o.id !== order.id));
  };

  const tabClass = (on: boolean) => `px-3 py-1.5 rounded text-sm font-medium ${on ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'}`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Porudžbine sa sajta</h1>
      <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-700 space-y-1">
        <p className="font-semibold">Kako radi</p>
        <p>1. Kupac plati preko PayPal-a → porudžbina se sama pojavi ovde (i stigne ti mejl kao do sada).</p>
        <p>2. Klikni porudžbinu → faktura se sama popuni: kupac, adresa, PayPal broj transakcije, stavke, šifre, kurs NBS.</p>
        <p>3. Proveri i izmeni šta hoćeš (cene, opise, težine…) → <strong>Sačuvaj i preuzmi Excel</strong>.</p>
        <p>4. Kad je paket poslat → <strong>Završeno</strong>, porudžbina prelazi u „Završene“. Porudžbinu bez fakture možeš i da obrišeš.</p>
        <p className="text-gray-500">Nove porudžbine bez fakture su označene žuto.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('active')} className={tabClass(tab === 'active')}>Aktivne ({active.length})</button>
        <button onClick={() => setTab('done')} className={tabClass(tab === 'done')}>Završene ({done.length})</button>
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}

      {shown.length === 0 ? (
        <p className="text-gray-600">
          {tab === 'done' ? 'Još nema završenih porudžbina.' : (
            <>Nema aktivnih porudžbina. Za eBay ili ranije porudžbine napravi <Link to="/admin/invoices/new" className="text-blue-600 underline">novu fakturu</Link> ručno.</>
          )}
        </p>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y">
          {shown.map((order) => {
            const invoice = order.invoices[0];
            return (
              <Link
                key={order.id}
                to={`/admin/orders/${order.id}`}
                className={`flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 hover:bg-gray-50 ${invoice || order.archived ? '' : 'border-l-4 border-amber-400'}`}
              >
                <span className="text-sm text-gray-500 w-36">{formatDateTime(order.created_at)}</span>
                <span className="font-medium flex-1 min-w-[12rem]">
                  {isDemoOrder(order) && (
                    <span className="mr-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-semibold">PRIMER</span>
                  )}
                  {customer(order)}
                  <span className="block text-sm text-gray-500 font-normal">
                    {order.country} · {order.order_items.reduce((sum, item) => sum + item.quantity, 0)} kom.
                  </span>
                </span>
                <span className="w-24 text-right font-medium">€{Number(order.total).toFixed(2)}</span>
                <span className="w-44 text-sm">
                  {invoice ? (
                    <span className="text-green-700">{invoiceNumberText(invoice)}</span>
                  ) : (
                    <span className="text-amber-700">Faktura nije izdata</span>
                  )}
                </span>
                <span className="flex gap-2 w-48 justify-end">
                  {order.archived ? (
                    <button onClick={(e) => act(e, archive(order, false))} className="px-2.5 py-1 text-xs border rounded hover:bg-gray-100">Vrati u aktivne</button>
                  ) : (
                    <button onClick={(e) => act(e, archive(order, true))} className="px-2.5 py-1 text-xs border rounded text-green-700 border-green-300 hover:bg-green-50">Završeno ✓</button>
                  )}
                  {!invoice && (
                    <button onClick={(e) => act(e, remove(order))} className="px-2.5 py-1 text-xs border rounded text-red-600 border-red-200 hover:bg-red-50">Obriši</button>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
