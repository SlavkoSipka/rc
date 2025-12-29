import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product } from '../types';
import { supabase } from '../lib/supabase';
import { useProductStock } from '../hooks/useProductStock';

interface CartItem extends Product {
  quantity: number;
  currentPrice?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartCount: () => number;
}

interface ProductStockInfo {
  price: number | null;
  stock: number | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [productStocks, setProductStocks] = useState<Record<string, ProductStockInfo>>({});

  // Fetch stock information for all items in the cart
  useEffect(() => {
    const fetchStockInfo = async () => {
      const stockInfo: Record<string, ProductStockInfo> = {};
      
      for (const item of items) {
        if (!productStocks[item.id]) {
          const { data } = await supabase
            .from('products')
            .select('price, stock')
            .eq('id', item.id)
            .single();
          
          if (data) {
            stockInfo[item.id] = {
              price: data.price,
              stock: data.stock
            };
          }
        }
      }
      
      setProductStocks(prev => ({ ...prev, ...stockInfo }));
    };

    fetchStockInfo();
  }, [items]);

  const addToCart = (product: Product) => {
    setItems(currentItems => {
      const existingItem = currentItems.find(item => item.id === product.id);
      const currentQuantity = existingItem?.quantity || 0;
      const stockInfo = productStocks[product.id];
      
      // Don't add more than available stock
      if (product.stock !== null && currentQuantity >= product.stock) {
        return currentItems;
      }
      
      if (existingItem) {
        return currentItems.map(item =>
          item.id === product.id
            ? { 
                ...item, 
                quantity: Math.min(item.quantity + 1, product.stock ?? Infinity),
                currentPrice: stockInfo?.price ?? item.price
              }
            : item
        );
      }
      
      return [...currentItems, { 
        ...product, 
        quantity: 1, 
        currentPrice: stockInfo?.price ?? product.price 
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems(currentItems =>
      currentItems.map(item =>
        item.id === productId 
          ? {
              ...item,
              quantity: Math.max(0, Math.min(quantity, item.stock ?? Infinity))
            } 
          : item
      ).filter(item => item.quantity > 0)
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getCartCount = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}