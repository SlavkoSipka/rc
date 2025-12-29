import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { ProductCard } from '../ProductCard';
import { Product } from '../../types';

interface SimilarProductsProps {
  currentProductId: string;
  products: Product[];
}

export function SimilarProducts({ currentProductId, products }: SimilarProductsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const similarProducts = products
    .filter(product => product.id !== currentProductId)
    .slice(0, 12);

  return (
    <div className="relative">
      <h2 className="text-xl font-bold mb-6">Similar Products</h2>
      
      <div className="relative group">
        <div 
        ref={scrollContainerRef}
        className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
        {similarProducts.map((product) => (
          <div key={product.id} className="min-w-[280px] max-w-[280px]">
            <ProductCard {...product} />
          </div>
        ))}
        </div>
        
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll left"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll right"
        >
          <ChevronRight size={24} className="text-white" />
        </button>
      </div>
    </div>
  );
}