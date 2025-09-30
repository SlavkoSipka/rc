import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { products } from '../../data/products';
import { Product } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../utils/format';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      handleSearch(value);
      setIsOpen(true);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPrices = useCallback(async (productIds: string[]) => {
    if (productIds.length === 0) return;

    const { data, error } = await supabase
      .from('products')
      .select('id, price')
      .in('id', productIds);

    if (!error && data) {
      const priceMap = data.reduce((acc, item) => ({
        ...acc,
        [item.id]: item.price
      }), {});
      setPrices(priceMap);
    }
  }, []);

  const handleSearch = (searchQuery: string) => {
    onChange(searchQuery);
    if (searchQuery.length >= 1) {
      // Special case for DF01 to include variations
      const searchTerm = searchQuery.toUpperCase() === 'DF01' ? 'df01' : searchQuery.toLowerCase();
      const filtered = products.filter(product =>
        product.title.toLowerCase().includes(searchTerm) ||
        product.id.toLowerCase().includes(searchTerm)
      );
      setSuggestions(filtered.slice(0, 10));
      fetchPrices(filtered.slice(0, 10).map(p => p.id));
      setIsOpen(true);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      const searchTerm = value.trim().toUpperCase() === 'DF01' ? 'DF01' : value.trim();
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
      setIsOpen(false);
    }
  };

  const handleSuggestionClick = (product: Product) => {
    navigate(`/product/${product.id}`);
    setIsOpen(false);
    onChange('');
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for RC parts..."
            className="w-full px-4 py-2 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          />
        </div>
      </form>

      {isOpen && suggestions.length > 0 && (
        <div className="fixed md:absolute left-4 right-4 md:left-0 md:right-0 md:w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-[80vh] overflow-y-auto z-50">
          {suggestions.map((product) => (
            <div
              key={product.id}
              onClick={() => handleSuggestionClick(product)}
              className="flex items-center p-4 md:p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
            >
              <img src={product.image} alt={product.title} className="w-20 h-20 md:w-12 md:h-12 object-cover rounded" />
              <div className="ml-4 md:ml-3 flex-1">
                <div className="text-base md:text-sm font-medium text-gray-900 line-clamp-2">{product.title}</div>
                <div className="text-base md:text-sm text-blue-600 mt-1">
                  {prices[product.id] ? `€${formatPrice(prices[product.id])}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}