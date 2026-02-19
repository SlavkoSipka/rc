import { useSearchParams } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef } from 'react';
import { ListFilter } from 'lucide-react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ProductCard } from '../components/ProductCard';
import { Pagination } from '../components/Pagination'; 
import { products } from '../data/products';
import { supabase } from '../lib/supabase';

const PRODUCTS_PER_PAGE = 25;

function getFilteredProducts(query: string) {
  // Special case for DF01 to include variations
  if (query.toUpperCase() === 'DF01') {
    return products.filter(product =>
      product.title.toLowerCase().includes('df01') || 
      product.id.toLowerCase().includes('df01') ||
      product.title.toLowerCase().includes('top force') ||
      product.id.toLowerCase().includes('top-force')
    );
  }
  
  return products.filter(product =>
    product.title.toLowerCase().includes(query.toLowerCase()) ||
    product.id.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 100);
}

type SortOption = 'relevance' | 'cheaper' | 'expensive' | 'popular';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const [sortOption, setSortOption] = useState<SortOption>('relevance');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const query = searchParams.get('q') || '';
  const [currentPage, setCurrentPage] = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [productData, setProductData] = useState<Record<string, { price: number; stock: number }>>({});

  // Jedan batch fetch za sve podatke
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
    resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  const searchResults = useMemo(() => {
    const filtered = getFilteredProducts(query);

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
          return 0; // zadržava originalni redosled filtriranja
      }
    });
  }, [query, sortOption, productData]);

  const totalPages = Math.ceil(searchResults.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedResults = searchResults.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

  return (
    <>
      <Header />
      <div ref={resultsRef} className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {searchResults.length} {searchResults.length === 1 ? 'Result' : 'Results'} for "{query}"
          </h1>
          
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
        {searchResults.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl text-gray-600">No products found</h2>
            <p className="mt-2 text-gray-500">Try searching with different keywords</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
            {paginatedResults.map(product => (
              <ProductCard
                key={product.id}
                {...product}
                preloadedPrice={productData[product.id]?.price}
                preloadedStock={productData[product.id]?.stock}
              />
            ))}
          </div>
        )}
        
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
      <Footer />
    </>
  );
}
