import { ProductCard } from '../components/ProductCard';
import { useState, useMemo, useEffect, useRef } from 'react';
import { ListFilter } from 'lucide-react';
import { Hero } from '../components/Hero';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Pagination } from '../components/Pagination';
import { products } from '../data/products'; 
import { supabase } from '../lib/supabase';

type SortOption = 'relevance' | 'cheaper' | 'expensive' | 'popular';

const PRODUCTS_PER_PAGE = 25;

// Stabilni redosled za 'relevance' sort - računa se jednom
const stableOrder = products.map((p, i) => ({ id: p.id, order: i }));
const stableOrderMap = Object.fromEntries(stableOrder.map(o => [o.id, o.order]));

export function HomePage() {
  const [sortOption, setSortOption] = useState<SortOption>('relevance');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const productsRef = useRef<HTMLDivElement>(null);
  const [productData, setProductData] = useState<Record<string, { price: number; stock: number }>>({});

  // Jedan batch fetch za SVE proizvode - cena i stanje
  useEffect(() => {
    async function fetchAllProductData() {
      const { data, error } = await supabase
        .from('products')
        .select('id, price, stock');
      
      if (!error && data) {
        const map = data.reduce((acc, item) => ({
          ...acc,
          [item.id]: { price: item.price, stock: item.stock }
        }), {} as Record<string, { price: number; stock: number }>);
        setProductData(map);
      }
    }
    
    fetchAllProductData();
  }, []);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    productsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // useMemo - sortiranje se računa samo kad se sortOption ili productData promene
  const sortedProducts = useMemo(() => {
    // Filtriraj duplikate
    const filtered = products.filter(product => 
      !product.id.includes('tamiya-trf201-211-201xmw') ||
      (!product.id.includes('silver') && !product.id.includes('blue'))
    );

    return [...filtered].sort((a, b) => {
      const aPrice = productData[a.id]?.price ?? a.price;
      const bPrice = productData[b.id]?.price ?? b.price;

      switch (sortOption) {
        case 'cheaper':
          return aPrice - bPrice;
        case 'expensive':
          return bPrice - aPrice;
        case 'popular':
          return bPrice - aPrice;
        default:
          // Stabilan redosled baziran na originalnom poretku - bez Math.random()
          return (stableOrderMap[a.id] ?? 0) - (stableOrderMap[b.id] ?? 0);
      }
    });
  }, [sortOption, productData]);

  const totalPages = Math.ceil(sortedProducts.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

  return (
    <>
      <Header />
      <Hero />
      
      {/* Featured Products */}
      <section className="py-12 bg-blue-50">
        <div ref={productsRef} className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Featured Products</h2>
            
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center gap-2 px-6 py-3 bg-white border rounded-lg hover:bg-gray-50 text-base font-medium transition-all ${sortOption !== 'relevance' ? 'text-blue-600 border-blue-600 shadow-sm' : 'hover:border-gray-300'}`}
              >
                <ListFilter className="w-5 h-5" />
                <span>Sort</span>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10 py-2">
                  <button
                    onClick={() => { setSortOption('relevance'); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${sortOption === 'relevance' ? 'text-blue-600' : ''}`}
                  >
                    Relevance
                  </button>
                  <button
                    onClick={() => { setSortOption('cheaper'); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${sortOption === 'cheaper' ? 'text-blue-600' : ''}`}
                  >
                    Price: Low to High
                  </button>
                  <button
                    onClick={() => { setSortOption('expensive'); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${sortOption === 'expensive' ? 'text-blue-600' : ''}`}
                  >
                    Price: High to Low
                  </button>
                  <button
                    onClick={() => { setSortOption('popular'); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${sortOption === 'popular' ? 'text-blue-600' : ''}`}
                  >
                    Most Popular
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {paginatedProducts.map((product) => (
              <ProductCard
                key={product.id}
                {...product}
                preloadedPrice={productData[product.id]?.price}
                preloadedStock={productData[product.id]?.stock}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
