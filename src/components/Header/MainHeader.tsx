import { ShoppingCart, Menu, Search, X, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COMPANY } from '../../constants';
import { SearchBar } from '../Search/SearchBar';
import { CartPanel } from '../Cart/CartPanel';
import { useCart } from '../../contexts/CartContext';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function MainHeader() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isYokomoOpen, setIsYokomoOpen] = useState(false);
  const [isTamiyaOpen, setIsTamiyaOpen] = useState(false);
  const [isSchumacherOpen, setIsSchumacherOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tamiyaDropdownRef = useRef<HTMLDivElement>(null);
  const schumacherDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const handleNavClick = (text: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    console.log('Navigacija kliknuta:', text); // Za debug, možeš ukloniti
    setIsMobileMenuOpen(false);
    setIsYokomoOpen(false);
    setIsTamiyaOpen(false);
    setIsSchumacherOpen(false);
    navigate(`/search?q=${encodeURIComponent(text)}`);
  };

  const handleCloseSearch = () => {
    setIsMobileSearchOpen(false);
    setSearchQuery('');
  };

  const handleCloseMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setIsYokomoOpen(false);
    setIsTamiyaOpen(false);
    setIsSchumacherOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        isMobileMenuOpen
      ) {
        handleCloseMobileMenu();
      }
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !event.target.closest('button')
      ) {
        setIsYokomoOpen(false);
      }
      if (
        tamiyaDropdownRef.current &&
        !tamiyaDropdownRef.current.contains(event.target as Node) &&
        !event.target.closest('button')
      ) {
        setIsTamiyaOpen(false);
      }
      if (
        schumacherDropdownRef.current &&
        !schumacherDropdownRef.current.contains(event.target as Node) &&
        !event.target.closest('button')
      ) {
        setIsSchumacherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <header className="bg-white shadow-lg sticky top-0 z-40 w-full">
      <div className="container mx-auto px-4 max-w-full">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 text-gray-600" />
              ) : (
                <Menu className="h-6 w-6 text-gray-600" />
              )}
            </button>
            <Link to="/">
              <img 
                src={COMPANY.LOGO_URL} 
                alt={COMPANY.NAME} 
                className={`h-10 ${isMobileSearchOpen ? 'hidden md:block' : 'block'} md:h-14`} 
              />
            </Link>
          </div>
          
          <div className={`flex-1 max-w-xl mx-4 ${isMobileSearchOpen ? 'block' : 'hidden md:block'}`}>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <SearchBar value={searchQuery} onChange={setSearchQuery} />
              </div>
              <Link
                to="/outlet"
                className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap min-w-[120px] text-center"
              >
                Outlet
              </Link>
            </div>
          </div>

          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden">
              <div 
                ref={mobileMenuRef}
                className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-xl transform transition-transform duration-200 ease-in-out overflow-y-auto"
              >
                <div className="p-4">
                  <div className="flex tydy items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Menu</h2>
                    <button onClick={handleCloseMobileMenu}>
                      <X className="h-6 w-6 text-gray-600" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="border-b pb-4">
                      <Link
                        to="/outlet"
                        className="block w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
                        onClick={handleCloseMobileMenu}
                      >
                        Outlet
                      </Link>
                    </div>

                    <div className="border-b pb-4">
                      <button 
                        className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg font-medium flex items-center justify-between"
                        onClick={() => setIsYokomoOpen(!isYokomoOpen)}
                      >
                        <span>Yokomo</span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${isYokomoOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isYokomoOpen && (
                        <div className="mt-2 bg-white rounded-lg">
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left" 
                            onClick={(e) => handleNavClick('Super Dogfighter', e)}
                          >
                            Super Dogfighter
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="border-b pb-4">
                      <button 
                        className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg font-medium flex items-center justify-between"
                        onClick={() => setIsTamiyaOpen(!isTamiyaOpen)}
                      >
                        <span>Tamiya</span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${isTamiyaOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isTamiyaOpen && (
                        <div className="mt-2 bg-white rounded-lg">
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left"
                            onClick={(e) => handleNavClick('DF01', e)}
                          >
                            DF01
                          </button>
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left"
                            onClick={(e) => handleNavClick('TA01', e)}
                          >
                            TA01
                          </button>
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left"
                            onClick={(e) => handleNavClick('TA02', e)}
                          >
                            TA02
                          </button>
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left"
                            onClick={(e) => handleNavClick('TRF201', e)}
                          >
                            TRF201
                          </button>
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left"
                            onClick={(e) => handleNavClick('DF03', e)}
                          >
                            DF03
                          </button>
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left"
                            onClick={(e) => handleNavClick('TT02', e)}
                          >
                            TT02
                          </button>
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left"
                            onClick={(e) => handleNavClick('Dyna Storm', e)}
                          >
                            Dyna Storm
                          </button>
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left"
                            onClick={(e) => handleNavClick('Astute', e)}
                          >
                            Astute
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="border-b pb-4">
                      <button 
                        className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg font-medium flex items-center justify-between"
                        onClick={() => setIsSchumacherOpen(!isSchumacherOpen)}
                      >
                        <span>Schumacher</span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${isSchumacherOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isSchumacherOpen && (
                        <div className="mt-2 bg-white rounded-lg">
                          <button 
                            className="block w-full px-4 py-3 text-blue-600 hover:bg-gray-50 text-left"
                            onClick={(e) => handleNavClick('Pro Cat', e)}
                          >
                            Pro Cat
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Navigation */}
          <div className={`hidden md:flex items-center space-x-4 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsYokomoOpen(!isYokomoOpen)}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2 ml-2"
              >
                Yokomo
                <ChevronDown className={`w-4 h-4 transition-transform ${isYokomoOpen ? 'rotate-180' : ''}`} />
              </button>
              {isYokomoOpen && (
                <div className="absolute z-50 mt-2 w-64 bg-blue-500 rounded-lg shadow-xl border border-blue-400">
                  <div className="py-2">
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('Super Dogfighter', e)}
                    >
                      Super Dogfighter
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={tamiyaDropdownRef}>
              <button 
                onClick={() => setIsTamiyaOpen(!isTamiyaOpen)}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
              >
                Tamiya
                <ChevronDown className={`w-4 h-4 transition-transform ${isTamiyaOpen ? 'rotate-180' : ''}`} />
              </button>
              {isTamiyaOpen && (
                <div className="absolute z-50 mt-2 w-64 bg-blue-500 rounded-lg shadow-xl border border-blue-400">
                  <div className="py-2">
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('DF01', e)}
                    >
                      DF01
                    </button>
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('TA01', e)}
                    >
                      TA01
                    </button>
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('TA02', e)}
                    >
                      TA02
                    </button>
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('TRF201', e)}
                    >
                      TRF201
                    </button>
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('DF03', e)}
                    >
                      DF03
                    </button>
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('TT02', e)}
                    >
                      TT02
                    </button>
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('Dyna Storm', e)}
                    >
                      Dyna Storm
                    </button>
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('Astute', e)}
                    >
                      Astute
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={schumacherDropdownRef}>
              <button 
                onClick={() => setIsSchumacherOpen(!isSchumacherOpen)}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
              >
                Schumacher
                <ChevronDown className={`w-4 h-4 transition-transform ${isSchumacherOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSchumacherOpen && (
                <div className="absolute z-50 mt-2 w-64 bg-blue-500 rounded-lg shadow-xl border border-blue-400">
                  <div className="py-2">
                    <button 
                      className="block w-full px-4 py-2 text-white font-medium hover:bg-blue-600 transition-colors text-left"
                      onClick={(e) => handleNavClick('Pro Cat', e)}
                    >
                      Pro Cat
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden"
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            >
              {isMobileSearchOpen ? (
                <X className="h-6 w-6 text-gray-600" />
              ) : (
                <Search className="h-6 w-6 text-gray-600" />
              )}
            </button>
            <button 
              className="relative"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingCart className="h-6 w-6 text-gray-600" />
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getCartCount()}
              </span>
            </button>
            <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
          </div>
        </div>
      </div>
    </header>
  );
}

export default MainHeader;