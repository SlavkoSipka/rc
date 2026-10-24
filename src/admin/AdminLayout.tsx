import { FormEvent, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { countOrdersWithoutInvoice } from './adminData';
import { useAdminSession } from './useAdminSession';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError('Pogrešan email ili lozinka.');
  };

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto mt-24 bg-white rounded-lg shadow p-6 space-y-4">
      <h1 className="text-xl font-bold">Admin prijava</h1>
      <label className="block">
        <span className="block text-sm text-gray-600 mb-1">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="block text-sm text-gray-600 mb-1">Lozinka</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full border rounded px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-blue-600 text-white rounded py-2 font-medium hover:bg-blue-700 disabled:bg-gray-400"
      >
        {busy ? 'Prijava…' : 'Prijavi se'}
      </button>
    </form>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded text-sm font-medium ${isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`;

// Orders still waiting for an invoice, refreshed every minute and when the page changes
function useNewOrdersCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  const location = useLocation();
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => countOrdersWithoutInvoice().then(setCount);
    void refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [enabled, location.pathname]);
  return count;
}

export function AdminLayout() {
  const { session, status } = useAdminSession();
  const newOrders = useNewOrdersCount(status === 'admin');

  if (status === 'loading') {
    return <p className="p-8 text-gray-500">Učitavanje…</p>;
  }
  if (status === 'signed-out') {
    return (
      <div className="min-h-screen bg-gray-100 px-4">
        <LoginForm />
      </div>
    );
  }
  if (status === 'not-admin') {
    return (
      <div className="min-h-screen bg-gray-100 px-4">
        <div className="max-w-md mx-auto mt-24 bg-white rounded-lg shadow p-6 space-y-4">
          <p>
            Nalog <strong>{session?.user.email}</strong> nema admin pristup.
          </p>
          <button onClick={() => supabase.auth.signOut()} className="text-blue-600 underline">
            Odjavi se
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="font-bold mr-4">Custom RC Parts · Admin</span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/admin/orders" className={navClass}>
              Porudžbine
              {newOrders > 0 && (
                <span className="ml-1.5 px-1.5 rounded-full bg-amber-400 text-gray-900 text-xs font-bold">{newOrders}</span>
              )}
            </NavLink>
            <NavLink to="/admin/invoices" end className={navClass}>Fakture</NavLink>
            <NavLink to="/admin/invoices/new" className={navClass}>Nova faktura</NavLink>
            <NavLink to="/admin/products" className={navClass}>Proizvodi</NavLink>
            <NavLink to="/admin/labels" className={navClass}>Nalepnice</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-gray-600">
            <span className="hidden sm:inline">{session?.user.email}</span>
            <button onClick={() => supabase.auth.signOut()} className="text-blue-600 hover:underline">
              Odjava
            </button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
