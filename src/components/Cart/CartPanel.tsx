import { ShoppingBag, X, Plus, Minus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { formatPrice } from '../../utils/format';
import { useEffect, useState, useCallback } from 'react';
import { useDiscount } from '../../contexts/DiscountContext';
import { supabase } from '../../lib/supabase';

interface CartPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PriceMap {
  [key: string]: number;
}

export function CartPanel({ isOpen, onClose }: CartPanelProps) {
  const { items, updateQuantity, removeFromCart } = useCart();
  const navigate = useNavigate();
  const [prices, setPrices] = useState<PriceMap>({});
  const { applyDiscount } = useDiscount();
  
  const fetchPrices = useCallback(async () => {
    if (items.length === 0) return;

    const { data, error } = await supabase
      .from('products')
      .select('id, price')
      .in('id', items.map(item => item.id));

    if (!error && data) {
      const priceMap = data.reduce((acc, item) => ({
        ...acc,
        [item.id]: item.price
      }), {});
      setPrices(priceMap);
    }
  }, [items]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const itemsWithPrices = items.map(item => ({
    ...item,
    currentPrice: prices[item.id] ?? item.price
  }));

  const subtotal = itemsWithPrices.reduce((total, item) => total + (applyDiscount(item.currentPrice) * item.quantity), 0);
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const shipping = totalQuantity > 0 ? 8.50 + (Math.max(0, totalQuantity - 1) * 2) : 0;
  const total = subtotal + shipping;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 w-full max-w-[320px] bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            <h2 className="text-lg font-semibold">Shopping Cart</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {itemsWithPrices.map((item) => (
                <div key={item.id} className="flex gap-4 bg-white rounded-lg p-4 border">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium line-clamp-2">{item.title}</h3>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, Math.max(0, Math.min(item.quantity - 1, item.stock)))}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, Math.min(item.quantity + 1, item.stock))}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 text-blue-600 font-medium">
                      €{formatPrice(applyDiscount(item.currentPrice) * item.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>€{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Shipping</span>
                <span>€{formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between text-base font-medium pt-2 border-t">
                <span>Total</span>
                <span>€{formatPrice(total)}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <button 
                onClick={() => {
                  onClose();
                  navigate('/checkout');
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-full font-medium hover:bg-blue-700 transition-colors"
              >
                Proceed to Checkout
              </button>
              <button 
                onClick={onClose}
                className="w-full bg-gray-100 text-gray-800 py-3 rounded-full font-medium hover:bg-gray-200 transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}