import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminOrder, fetchOrders, isDemoOrder } from '../adminData';
import { invoiceNumberText } from '../invoice/invoiceLogic';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders().then(setOrders).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">Greška: {error}</p>;
  if (!orders) return <p className="text-gray-500">Učitavanje porudžbina…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Porudžbine sa sajta</h1>
      <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-700 space-y-1">
        <p className="font-semibold">Kako radi</p>
        <p>1. Kupac plati preko PayPal-a → porudžbina se sama pojavi ovde (i stigne ti mejl kao do sada).</p>
        <p>2. Klikni porudžbinu → faktura se sama popuni: kupac, adresa, PayPal broj transakcije, stavke, šifre, kurs NBS.</p>
        <p>3. Proveri i izmeni šta hoćeš (cene, opise, težine…) → <strong>Sačuvaj i preuzmi Excel</strong>.</p>
        <p className="text-gray-500">Nove porudžbine bez fakture su označene žuto.</p>
      </div>
      {orders.length === 0 ? (
        <p className="text-gray-600">
          Još nema porudžbina. Svaka plaćena porudžbina sa sajta se ovde pojavi automatski. Za eBay ili
          ranije porudžbine napravi <Link to="/admin/invoices/new" className="text-blue-600 underline">novu fakturu</Link> ručno.
        </p>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y">
          {orders.map((order) => {
            const invoice = order.invoices[0];
            return (
              <Link
                key={order.id}
                to={`/admin/orders/${order.id}`}
                className={`flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 hover:bg-gray-50 ${invoice ? '' : 'border-l-4 border-amber-400'}`}
              >
                <span className="text-sm text-gray-500 w-36">{formatDateTime(order.created_at)}</span>
                <span className="font-medium flex-1 min-w-[12rem]">
                  {isDemoOrder(order) && (
                    <span className="mr-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-semibold">PRIMER</span>
                  )}
                  {[order.first_name, order.last_name].filter(Boolean).join(' ') || order.payer_name}
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
