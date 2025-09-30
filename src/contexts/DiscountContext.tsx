import { createContext, useContext, useState, ReactNode } from 'react';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface DiscountContextType {
  discount: number;
  setDiscount: (value: number) => void;
  applyDiscount: (price: number) => number;
}

const DiscountContext = createContext<DiscountContextType | undefined>(undefined);

export function DiscountProvider({ children }: { children: ReactNode }) {
  const [discount, setDiscount] = useState(0);

  // Fetch active discount from Supabase
  useEffect(() => {
    async function fetchActiveDiscount() {
      try {
        const { data, error } = await supabase
          .from('discount')
          .select('percentage')
          .eq('id', 1)
          .single();
        
        if (!error && data) {
          setDiscount(data.percentage);
        }
      } catch (error) {
        console.error('Error fetching active discount:', error);
      }
    }

    fetchActiveDiscount();

    // Set up real-time subscription to discount changes
    const subscription = supabase
      .channel('discount-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'discount' 
        }, 
        () => {
          fetchActiveDiscount();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  const applyDiscount = (price: number) => {
    if (discount <= 0) return price;
    return price * (1 - discount / 100);
  };

  return (
    <DiscountContext.Provider value={{ discount, setDiscount, applyDiscount }}>
      {children}
    </DiscountContext.Provider>
  );
}

export function useDiscount() {
  const context = useContext(DiscountContext);
  if (context === undefined) {
    throw new Error('useDiscount must be used within a DiscountProvider');
  }
  return context;
}