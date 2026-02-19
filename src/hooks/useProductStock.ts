import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useProductStock(productId: string, initialPrice?: number, initialStock?: number) {
  const [stock, setStock] = useState<number | null>(initialStock ?? null);
  const [price, setPrice] = useState<number | null>(initialPrice ?? null);
  const [loading, setLoading] = useState(initialPrice === undefined || initialStock === undefined);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Ako su vrednosti već prosleđene, ne treba fetch
    if (initialPrice !== undefined && initialStock !== undefined) {
      setPrice(initialPrice);
      setStock(initialStock);
      setLoading(false);
      return;
    }

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
  }, [productId, initialPrice, initialStock]);

  return { stock, price, loading, error };
}
