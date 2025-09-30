import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ProductCard } from '../components/ProductCard';
import { useState } from 'react';
import { ListFilter } from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { useProductStock } from '../hooks/useProductStock';
import { outletDefectProducts } from '../data/dataOutletDefect';
import { outletUsedProducts } from '../data/dataOutletUsed';

const PRODUCTS_PER_PAGE = 24;

type Section = 'defects' | 'regular';

export function OutletPage() {
  const [sortOption, setSortOption] = useState<'relevance' | 'price-asc' | 'price-desc'>('relevance');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSection, setActiveSection] = useState<Section>('defects');

  // Reset page when changing sections
  const handleSectionChange = (section: 'defects' | 'regular') => {
    setActiveSection(section);
    setCurrentPage(1);
  };

  const currentProducts = activeSection === 'defects' 
    ? outletDefectProducts 
    : outletUsedProducts;
  
  const sortedProducts = currentProducts;

  const totalPages = Math.ceil(sortedProducts.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-8 mb-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">RC Parts Outlet</h1>
              <p className="text-lg opacity-90 max-w-3xl mx-auto mb-6">
                The items listed here are ones that did not pass Quality Control due to visual inconsistencies, 
                or have slight production imperfections. Both of which do not affect the overall performance of the product.
              </p>
              <p className="text-lg opacity-90 mb-12">
                You will also find new and used original manufacture parts from Tamiya and other brands.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleSectionChange('defects')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  activeSection === 'defects'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Products with Minor Defects
              </button>
              <button
                onClick={() => handleSectionChange('regular')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  activeSection === 'regular'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Used & New Products
              </button>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-6 py-3 bg-white border rounded-lg hover:bg-gray-50 text-base font-medium transition-all"
              >
                <ListFilter className="w-5 h-5" />
                <span>Sort</span>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10">
                  <button
                    onClick={() => {
                      setSortOption('relevance');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50"
                  >
                    Featured
                  </button>
                  <button
                    onClick={() => {
                      setSortOption('price-asc');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50"
                  >
                    Price: Low to High
                  </button>
                  <button
                    onClick={() => {
                      setSortOption('price-desc');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50"
                  >
                    Price: High to Low
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
            <p className="text-gray-700">
              {activeSection === 'defects'
                ? 'These items have cosmetic imperfections but are fully functional.'
                : 'Quality checked and tested products at great prices. Mix of new old stock and carefully inspected used items.'}
            </p>
          </div>

          {sortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No products available in this section</p>
            </div>
          ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}