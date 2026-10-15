import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchInvoices } from '../adminData';
import { formatDateSr, invoiceNumberText } from '../invoice/invoiceLogic';
import { downloadInvoiceXlsx } from '../invoice/invoiceXlsx';
import type { SavedInvoice } from '../invoice/types';

export function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<SavedInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices().then(setInvoices).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">Greška: {error}</p>;
  if (!invoices) return <p className="text-gray-500">Učitavanje faktura…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Izdate fakture</h1>
        <Link to="/admin/invoices/new" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          Nova faktura
        </Link>
      </div>
      {invoices.length === 0 ? (
        <p className="text-gray-600">Još nema izdatih faktura.</p>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
              <Link to={`/admin/invoices/${invoice.id}`} className="font-medium text-blue-700 hover:underline w-48">
                {invoiceNumberText(invoice)}
              </Link>
              <span className="text-sm text-gray-500 w-24">{formatDateSr(invoice.invoice_date)}</span>
              <span className="flex-1 min-w-[10rem]">{invoice.customer_name}</span>
              <span className="w-24 text-right">€{Number(invoice.total ?? 0).toFixed(2)}</span>
              <button
                onClick={() => downloadInvoiceXlsx(invoice.data)}
                className="text-sm text-blue-600 hover:underline"
              >
                Preuzmi Excel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
