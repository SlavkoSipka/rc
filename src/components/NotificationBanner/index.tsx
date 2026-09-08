import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useDiscount } from '../../contexts/DiscountContext';

export function NotificationBanner() {
  const [isVisible, setIsVisible] = useState(true); // OVDE AKTIVIRAS NOTIFIKACIJU
  const { discount, setDiscount } = useDiscount();
  
  useEffect(() => {
    setDiscount(0);
    return () => setDiscount(0);
  }, [setDiscount]);

  if (!isVisible) return null;

  const message = `⚡⚡⚡ IMPORTANT NOTICE...We are now able to offer FedEx E-Commerce shipping to the United States of America. Its the only way to ship our products to America at the moment⚡⚡⚡\nTracking numbers are being uploaded to PayPal right after dispatch`;

  return (
    <div className="bg-green-600 text-white py-3 relative">
      <div className="container mx-auto px-4 pr-12 text-center text-sm font-medium whitespace-pre-line">
        {message}
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
