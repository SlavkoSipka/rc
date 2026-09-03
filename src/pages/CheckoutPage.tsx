import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useProductStock } from '../hooks/useProductStock';
import { useDiscount } from '../contexts/DiscountContext';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header'; 
import { Footer } from '../components/Footer';
import { formatPrice, sumDiscountedLineTotals } from '../utils/format';
import { calculateShipping, storeShippingCountry } from '../utils/shipping';
import { COUNTRIES, getDialCode } from '../data/countries';
import { useRef, useState } from 'react';
import emailjs from '@emailjs/browser';

interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export function CheckoutPage() {
  const { items } = useCart();
  const navigate = useNavigate();
  const { applyDiscount } = useDiscount();
  
  // Get latest prices from Supabase for each item (already discounted in database)
  const [itemsWithPrices, setItemsWithPrices] = useState(items);
  
  useEffect(() => {
    const fetchLatestPrices = async () => {
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          const { data } = await supabase
            .from('products')
            .select('price')
            .eq('id', item.id)
            .single();
          
          return {
            ...item,
            currentPrice: data?.price ?? item.price
          };
        })
      );
      setItemsWithPrices(updatedItems);
    };
    
    fetchLatestPrices();
  }, [items]);
  const formRef = useRef<HTMLFormElement>(null);
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    countryCode: '+1', // Default for US
    address: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States'
  });

  // Update country code when country changes
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const country = e.target.value;

    storeShippingCountry(country);
    setShippingInfo(prev => ({
      ...prev,
      country,
      countryCode: getDialCode(country)
    }));
  };

  const subtotal = itemsWithPrices.reduce((total, item) => total + (item.currentPrice * item.quantity), 0);
  const discountedSubtotal = sumDiscountedLineTotals(itemsWithPrices, applyDiscount);
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const shipping = calculateShipping(totalQuantity, shippingInfo.country);
  const total = discountedSubtotal + shipping;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setShippingInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitShipping = (e: React.FormEvent) => {
    e.preventDefault();
    const form = formRef.current;
    if (form && form.checkValidity()) {
      // Navigate to payment page with order data
      navigate('/checkout/payment', {
        state: {
          items,
          shippingInfo,
          subtotal: discountedSubtotal,
          shipping,
          total
        }
      });
    } else {
      form?.reportValidity();
    }
  };

  useEffect(() => {
    if (items.length === 0) {
      navigate('/');
    }
  }, [items.length, navigate]);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-8">Checkout</h1>
            
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              <div className="space-y-4">
                {itemsWithPrices.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 py-4 border-b last:border-b-0">
                    <img 
                      src={item.image} 
                      alt={item.title}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-gray-500">Quantity: {item.quantity}</p>
                     <p className="text-blue-600 font-medium">€{formatPrice(applyDiscount(item.currentPrice * item.quantity))}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>€{formatPrice(discountedSubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Shipping</span>
                  <span>€{formatPrice(shipping)}</span>
                </div>
                <div className="flex justify-between text-lg font-medium pt-4 border-t">
                  <span>Total</span>
                  <span>€{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Shipping Information</h2>
              </div>
              <form ref={formRef} className="space-y-4" onSubmit={handleSubmitShipping}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country/Region
                  </label>
                  <select
                    name="country"
                    value={shippingInfo.country}
                    onChange={handleCountryChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map(country => (
                      <option key={country.iso2} value={country.name}>{country.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1  md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={shippingInfo.firstName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={shippingInfo.lastName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={shippingInfo.address}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                    placeholder="Street address, P.O. box, company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address 2 (optional)
                  </label>
                  <input
                    type="text"
                    name="address2"
                    value={shippingInfo.address2}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                    placeholder="Apartment, suite, unit, building, floor, etc."
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={shippingInfo.city}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State/Province/Region
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={shippingInfo.state}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                      placeholder="Enter state/province/region"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP/Postal Code
                    </label>
                    <input
                      type="text"
                      name="zipCode"
                      value={shippingInfo.zipCode}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                      placeholder="Enter ZIP code"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country Code
                    </label>
                    <input
                      type="text"
                      name="countryCode"
                      value={shippingInfo.countryCode}
                      readOnly
                      className="w-24 px-4 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={shippingInfo.phone}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                
                <div className="pt-6">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-3 rounded-full font-medium hover:bg-blue-700 transition-colors"
                  >
                    Continue to Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
