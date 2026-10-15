import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { AdminInvoiceEditorPage } from './pages/AdminInvoiceEditorPage';
import { AdminInvoicesPage } from './pages/AdminInvoicesPage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminProductsPage } from './pages/AdminProductsPage';

// Everything under /admin, loaded only when an admin page is opened
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:orderId" element={<AdminInvoiceEditorPage />} />
        <Route path="invoices" element={<AdminInvoicesPage />} />
        <Route path="invoices/:invoiceId" element={<AdminInvoiceEditorPage />} />
        <Route path="products" element={<AdminProductsPage />} />
      </Route>
    </Routes>
  );
}
