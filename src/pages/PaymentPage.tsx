import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useProductStock } from '../hooks/useProductStock';
import { useDiscount } from '../contexts/DiscountContext';
import { supabase } from '../lib/supabase';
import { PAYPAL_CONFIG } from '../config/paypal';
import { formatPrice } from '../utils/format';
import emailjs from '@emailjs/browser';

declare global {
  interface Window {
    paypal: any;
  }
}

export function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applyDiscount } = useDiscount();
  const [paypalScriptLoaded, setPaypalScriptLoaded] = useState(false);
  const paypalButtonsContainer = useRef<HTMLDivElement>(null);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  
  // Get order data from location state
  const orderData = location.state;

  if (!orderData) {
    // Redirect back to checkout if no order data
    useEffect(() => {
      navigate('/checkout');
    }, [navigate]);
    return null;
  }

  const { items, shippingInfo, subtotal, shipping, total } = orderData;
  
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

  // Format items for PayPal
  const paypalItems = itemsWithPrices.map((item: any) => ({
    name: item.title.substring(0, 127), // PayPal has a 127 char limit
    unit_amount: {
      currency_code: PAYPAL_CONFIG.CURRENCY,
      value: parseFloat(applyDiscount(item.currentPrice).toFixed(2)).toString()
    },
    quantity: item.quantity.toString(),
    category: 'PHYSICAL_GOODS'
  }));

  const sendOrderConfirmation = async (paypalOrderData: any) => {
    try {
      await emailjs.send(
        'service_fhgz9k5',
        'template_19flt1j',
        {
          order_id: paypalOrderData.id,
          customer_name: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
          customer_email: paypalOrderData.payer.email_address,
          customer_phone: shippingInfo.phone,
          shipping_firstName: shippingInfo.firstName,
          shipping_lastName: shippingInfo.lastName,
          shipping_phone: shippingInfo.phone,
          shipping_address: shippingInfo.address + (shippingInfo.address2 ? `\n${shippingInfo.address2}` : ''),
          shipping_city: shippingInfo.city,
          shipping_state: shippingInfo.state,
          shipping_zip: shippingInfo.zipCode,
          shipping_country: shippingInfo.country,
          items_list: items.map((item: any) => `${item.title} (${item.quantity}x)`).join('\n'),
          subtotal: formatPrice(subtotal),
          shipping_cost: formatPrice(shipping),
          total: formatPrice(total)
        },
        'Gc6J4VIypmQDaGtLS'
      );
    } catch (error) {
      console.error('Failed to send order confirmation:', error);
    }
  };

  // Load PayPal script only once when component mounts
  useEffect(() => {
    setPaypalError(null);
    if (!window.paypal) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${
        PAYPAL_CONFIG.MODE === 'sandbox' ? PAYPAL_CONFIG.SANDBOX_CLIENT_ID : PAYPAL_CONFIG.LIVE_CLIENT_ID
      }&currency=${PAYPAL_CONFIG.CURRENCY}&intent=capture&disable-funding=credit,card&components=buttons`;
      script.async = true;

      script.onload = () => {
        setPaypalScriptLoaded(true);
      };

      script.onerror = () => {
        console.error('Failed to load PayPal SDK script');
        setPaypalError('Failed to load PayPal SDK. Please refresh the page and try again.');
      };

      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    } else {
      // PayPal is already loaded
      setPaypalScriptLoaded(true);
    }
  }, []); // Empty dependency array ensures script is loaded only once

  // Initialize PayPal buttons after script loads
  useEffect(() => {
    if (paypalScriptLoaded && window.paypal && paypalButtonsContainer.current) {
      // Clear existing buttons
      paypalButtonsContainer.current.innerHTML = '';
      
      window.paypal
        .Buttons({
          style: {
            layout: 'horizontal',
            color: 'blue',
            shape: 'rect',
            label: 'pay',
            height: 40
          },
          createOrder: (_data: any, actions: any) => {
            console.log('Creating PayPal order...');
            return actions.order.create({
              intent: PAYPAL_CONFIG.INTENT,
              purchase_units: [{
                reference_id: 'default',
                amount: {
                  currency_code: PAYPAL_CONFIG.CURRENCY,
                  value: parseFloat(total.toFixed(2)).toString(),
                  breakdown: {
                    item_total: {
                      currency_code: PAYPAL_CONFIG.CURRENCY,
                      value: parseFloat(subtotal.toFixed(2)).toString()
                    },
                    shipping: {
                      currency_code: PAYPAL_CONFIG.CURRENCY,
                      value: parseFloat(shipping.toFixed(2)).toString()
                    }
                  }
                },
                items: paypalItems,
                description: `Order from Custom RC Parts - ${items.length} item(s)`,
                shipping: {
                  name: {
                    full_name: `${shippingInfo.firstName} ${shippingInfo.lastName}`
                  },
                  address: {
                    address_line_1: shippingInfo.address,
                    address_line_2: shippingInfo.address2 || undefined,
                    admin_area_2: shippingInfo.city,
                    admin_area_1: shippingInfo.state,
                    postal_code: shippingInfo.zipCode,
                    country_code: getCountryCode(shippingInfo.country)
                  }
                }
              }]
            }).catch((error: any) => {
              console.error('PayPal createOrder error:', error);
              setPaypalError('Failed to create PayPal order. Please try again.');
              throw error;
            });
          },
          onApprove: async (_data: any, actions: any) => {
            try {
              console.log('Capturing PayPal order...');
              const order = await actions.order.capture();
              console.log('PayPal order captured:', order);
              
              // Update stock quantities in Supabase
              for (const item of items) {
                const { error } = await supabase.rpc(
                  'update_product_stock',
                  { 
                    product_id: item.id,
                    quantity: item.quantity
                  }
                );
                
                if (error) {
                  console.error('Error updating stock:', error);
                  // Don't throw error here, order was successful
                }
              }
              
              await sendOrderConfirmation(order);
              navigate('/checkout/success');
            } catch (error) {
              console.error('Failed to update stock quantities:', error);
              // Order was successful even if stock update failed
              await sendOrderConfirmation(order);
              navigate('/checkout/success');
            }
          },
          onError: (err: any) => {
            console.error('PayPal error:', err);
            setPaypalError('There was a problem processing your payment. Please check your PayPal account and try again.');
          },
          onCancel: (data: any) => {
            console.log('PayPal payment cancelled:', data);
            setPaypalError('Payment was cancelled. You can try again when ready.');
          }
        })
        .render(paypalButtonsContainer.current)
        .catch((error: any) => {
          console.error('PayPal render error:', error);
          setPaypalError('Failed to load PayPal buttons. Please refresh the page and try again.');
        });
    }
  }, [paypalScriptLoaded, items, total, subtotal, shipping, navigate, paypalButtonsContainer]);

  // Helper function to get country code for PayPal
  const getCountryCode = (country: string): string => {
    const countryMap: { [key: string]: string } = {
      'United States': 'US',
      'Canada': 'CA',
      'United Kingdom': 'GB',
      'Germany': 'DE',
      'France': 'FR',
      'Italy': 'IT',
      'Spain': 'ES',
      'Australia': 'AU',
      'Japan': 'JP',
      'China': 'CN',
      'India': 'IN',
      'Brazil': 'BR',
      'Mexico': 'MX',
      'Russia': 'RU',
      'South Korea': 'KR',
      'Serbia': 'RS',
      'Netherlands': 'NL',
      'Belgium': 'BE',
      'Austria': 'AT',
      'Switzerland': 'CH',
      'Poland': 'PL',
      'Sweden': 'SE',
      'Norway': 'NO',
      'Denmark': 'DK',
      'Finland': 'FI'
    };
    return countryMap[country] || 'US';
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-8">Payment</h1>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              <div className="space-y-4">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-4 py-4 border-b last:border-b-0">
                    <img 
                      src={item.image} 
                      alt={item.title}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-gray-500">Quantity: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>€{formatPrice(subtotal)}</span>
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

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Complete Payment</h2>
              <p className="text-gray-600 mb-6">
                Complete your purchase securely with PayPal.
              </p>
              
              {paypalError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700">{paypalError}</p>
                  <button
                    onClick={() => {
                      setPaypalError(null);
                      window.location.reload();
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Refresh page and try again
                  </button>
                </div>
              )}
              
              {!paypalScriptLoaded && !paypalError && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading PayPal...</span>
                </div>
              )}
              
              <div ref={paypalButtonsContainer}></div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}