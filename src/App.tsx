import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { HomePage } from './pages/HomePage';

import { ProductPage } from './pages/ProductPage';
import { SearchPage } from './pages/SearchPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OutletPage } from './pages/OutletPage';
import { ShippingPage } from './pages/ShippingPage';
import { AboutPage } from './pages/AboutPage';
import { PaymentPage } from './pages/PaymentPage';
import { CheckoutSuccessPage } from './pages/CheckoutSuccessPage';
import { TermsAndPrivacyPage } from './pages/TermsAndPrivacyPage';
import { ProjectPage } from './pages/ProjectPage';
import { NotificationBanner } from './components/NotificationBanner';
import { flushPendingOrderEmails } from './utils/orderEmail';
import { flushPendingOrderRecords } from './utils/orderRecord';

const AdminApp = lazy(() => import('./admin/AdminApp'));

function App() {
  const location = useLocation();

  useEffect(() => {
    // Retry order emails / saving orders that a previous visit could not finish
    flushPendingOrderEmails();
    flushPendingOrderRecords();
  }, []);

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0);
    
    // Send page view to Google Analytics
    window.gtag('config', 'G-XQB2D4JZM7', {
      page_path: location.pathname,
    });
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-50">
      {!location.pathname.startsWith('/admin') && <NotificationBanner />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/outlet" element={<OutletPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/shipping" element={<ShippingPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/payment" element={<PaymentPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/terms-and-privacy" element={<TermsAndPrivacyPage />} />
        <Route path="/about-project" element={<ProjectPage />} />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<p className="p-8 text-gray-500">Učitavanje…</p>}>
              <AdminApp />
            </Suspense>
          }
        />
      </Routes>
    </div>
  );
}

export default App;