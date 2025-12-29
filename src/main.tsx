import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { CartProvider } from './contexts/CartContext';
import { DiscountProvider } from './contexts/DiscountContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DiscountProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </DiscountProvider>
    </BrowserRouter>
  </StrictMode>
);

