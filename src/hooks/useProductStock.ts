import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ProductStock {
  stock: number;
  price: number;
}

export function useProductStock(productId: string) {
  const [stock, setStock] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchStock() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('products')
          .select('stock, price')
          .eq('id', productId)
          .single();

        if (error) throw error;

        if (data) {
          setStock(data.stock);
          setPrice(data.price);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error fetching stock'));
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      fetchStock();
    }
  }, [productId]);

  return { stock, price, loading, error };
}