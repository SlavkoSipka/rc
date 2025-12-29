import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useProductStock } from '../hooks/useProductStock';
import { useDiscount } from '../contexts/DiscountContext';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header'; 
import { Footer } from '../components/Footer';
import { formatPrice } from '../utils/format';
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
    let countryCode = '+1'; // Default to US
    
    // Map countries to their calling codes
    switch (country) {
      case 'United States': countryCode = '+1'; break;
      case 'Canada': countryCode = '+1'; break;
      case 'United Kingdom': countryCode = '+44'; break;
      case 'Australia': countryCode = '+61'; break;
      case 'Germany': countryCode = '+49'; break;
      case 'France': countryCode = '+33'; break;
      case 'Italy': countryCode = '+39'; break;
      case 'Spain': countryCode = '+34'; break;
      case 'Japan': countryCode = '+81'; break;
      case 'China': countryCode = '+86'; break;
      case 'India': countryCode = '+91'; break;
      case 'Brazil': countryCode = '+55'; break;
      case 'Mexico': countryCode = '+52'; break;
      case 'Russia': countryCode = '+7'; break;
      case 'South Korea': countryCode = '+82'; break;
      case 'Afghanistan': countryCode = '+93'; break;
      case 'Albania': countryCode = '+355'; break;
      case 'Algeria': countryCode = '+213'; break;
      case 'Andorra': countryCode = '+376'; break;
      case 'Angola': countryCode = '+244'; break;
      case 'Argentina': countryCode = '+54'; break;
      case 'Armenia': countryCode = '+374'; break;
      case 'Austria': countryCode = '+43'; break;
      case 'Azerbaijan': countryCode = '+994'; break;
      case 'Bahamas': countryCode = '+1'; break;
      case 'Bahrain': countryCode = '+973'; break;
      case 'Bangladesh': countryCode = '+880'; break;
      case 'Belarus': countryCode = '+375'; break;
      case 'Belgium': countryCode = '+32'; break;
      case 'Belize': countryCode = '+501'; break;
      case 'Benin': countryCode = '+229'; break;
      case 'Bhutan': countryCode = '+975'; break;
      case 'Bolivia': countryCode = '+591'; break;
      case 'Bosnia and Herzegovina': countryCode = '+387'; break;
      case 'Botswana': countryCode = '+267'; break;
      case 'Brunei': countryCode = '+673'; break;
      case 'Bulgaria': countryCode = '+359'; break;
      case 'Burkina Faso': countryCode = '+226'; break;
      case 'Burundi': countryCode = '+257'; break;
      case 'Cambodia': countryCode = '+855'; break;
      case 'Cameroon': countryCode = '+237'; break;
      case 'Cape Verde': countryCode = '+238'; break;
      case 'Central African Republic': countryCode = '+236'; break;
      case 'Chad': countryCode = '+235'; break;
      case 'Chile': countryCode = '+56'; break;
      case 'Colombia': countryCode = '+57'; break;
      case 'Comoros': countryCode = '+269'; break;
      case 'Congo': countryCode = '+242'; break;
      case 'Costa Rica': countryCode = '+506'; break;
      case 'Croatia': countryCode = '+385'; break;
      case 'Cuba': countryCode = '+53'; break;
      case 'Cyprus': countryCode = '+357'; break;
      case 'Czech Republic': countryCode = '+420'; break;
      case 'Denmark': countryCode = '+45'; break;
      case 'Djibouti': countryCode = '+253'; break;
      case 'Dominican Republic': countryCode = '+1'; break;
      case 'Ecuador': countryCode = '+593'; break;
      case 'Egypt': countryCode = '+20'; break;
      case 'El Salvador': countryCode = '+503'; break;
      case 'Eritrea': countryCode = '+291'; break;
      case 'Estonia': countryCode = '+372'; break;
      case 'Ethiopia': countryCode = '+251'; break;
      case 'Fiji': countryCode = '+679'; break;
      case 'Finland': countryCode = '+358'; break;
      case 'Gabon': countryCode = '+241'; break;
      case 'Gambia': countryCode = '+220'; break;
      case 'Georgia': countryCode = '+995'; break;
      case 'Ghana': countryCode = '+233'; break;
      case 'Greece': countryCode = '+30'; break;
      case 'Grenada': countryCode = '+1'; break;
      case 'Guatemala': countryCode = '+502'; break;
      case 'Guinea': countryCode = '+224'; break;
      case 'Guyana': countryCode = '+592'; break;
      case 'Haiti': countryCode = '+509'; break;
      case 'Honduras': countryCode = '+504'; break;
      case 'Hungary': countryCode = '+36'; break;
      case 'Iceland': countryCode = '+354'; break;
      case 'Indonesia': countryCode = '+62'; break;
      case 'Iran': countryCode = '+98'; break;
      case 'Iraq': countryCode = '+964'; break;
      case 'Ireland': countryCode = '+353'; break;
      case 'Israel': countryCode = '+972'; break;
      case 'Jamaica': countryCode = '+1'; break;
      case 'Jordan': countryCode = '+962'; break;
      case 'Kazakhstan': countryCode = '+7'; break;
      case 'Kenya': countryCode = '+254'; break;
      case 'Kuwait': countryCode = '+965'; break;
      case 'Kyrgyzstan': countryCode = '+996'; break;
      case 'Laos': countryCode = '+856'; break;
      case 'Latvia': countryCode = '+371'; break;
      case 'Lebanon': countryCode = '+961'; break;
      case 'Lesotho': countryCode = '+266'; break;
      case 'Liberia': countryCode = '+231'; break;
      case 'Libya': countryCode = '+218'; break;
      case 'Liechtenstein': countryCode = '+423'; break;
      case 'Lithuania': countryCode = '+370'; break;
      case 'Luxembourg': countryCode = '+352'; break;
      case 'Madagascar': countryCode = '+261'; break;
      case 'Malawi': countryCode = '+265'; break;
      case 'Malaysia': countryCode = '+60'; break;
      case 'Maldives': countryCode = '+960'; break;
      case 'Mali': countryCode = '+223'; break;
      case 'Malta': countryCode = '+356'; break;
      case 'Mauritania': countryCode = '+222'; break;
      case 'Mauritius': countryCode = '+230'; break;
      case 'Moldova': countryCode = '+373'; break;
      case 'Monaco': countryCode = '+377'; break;
      case 'Mongolia': countryCode = '+976'; break;
      case 'Montenegro': countryCode = '+382'; break;
      case 'Morocco': countryCode = '+212'; break;
      case 'Mozambique': countryCode = '+258'; break;
      case 'Myanmar': countryCode = '+95'; break;
      case 'Namibia': countryCode = '+264'; break;
      case 'Nepal': countryCode = '+977'; break;
      case 'Netherlands': countryCode = '+31'; break;
      case 'New Zealand': countryCode = '+64'; break;
      case 'Nicaragua': countryCode = '+505'; break;
      case 'Niger': countryCode = '+227'; break;
      case 'Nigeria': countryCode = '+234'; break;
      case 'North Korea': countryCode = '+850'; break;
      case 'Norway': countryCode = '+47'; break;
      case 'Oman': countryCode = '+968'; break;
      case 'Pakistan': countryCode = '+92'; break;
      case 'Panama': countryCode = '+507'; break;
      case 'Papua New Guinea': countryCode = '+675'; break;
      case 'Paraguay': countryCode = '+595'; break;
      case 'Peru': countryCode = '+51'; break;
      case 'Philippines': countryCode = '+63'; break;
      case 'Poland': countryCode = '+48'; break;
      case 'Portugal': countryCode = '+351'; break;
      case 'Qatar': countryCode = '+974'; break;
      case 'Romania': countryCode = '+40'; break;
      case 'Rwanda': countryCode = '+250'; break;
      case 'Saudi Arabia': countryCode = '+966'; break;
      case 'Senegal': countryCode = '+221'; break;
      case 'Serbia': countryCode = '+381'; break;
      case 'Seychelles': countryCode = '+248'; break;
      case 'Sierra Leone': countryCode = '+232'; break;
      case 'Singapore': countryCode = '+65'; break;
      case 'Slovakia': countryCode = '+421'; break;
      case 'Slovenia': countryCode = '+386'; break;
      case 'Somalia': countryCode = '+252'; break;
      case 'South Africa': countryCode = '+27'; break;
      case 'Sri Lanka': countryCode = '+94'; break;
      case 'Sudan': countryCode = '+249'; break;
      case 'Sweden': countryCode = '+46'; break;
      case 'Switzerland': countryCode = '+41'; break;
      case 'Syria': countryCode = '+963'; break;
      case 'Taiwan': countryCode = '+886'; break;
      case 'Tajikistan': countryCode = '+992'; break;
      case 'Tanzania': countryCode = '+255'; break;
      case 'Thailand': countryCode = '+66'; break;
      case 'Togo': countryCode = '+228'; break;
      case 'Tunisia': countryCode = '+216'; break;
      case 'Turkey': countryCode = '+90'; break;
      case 'Turkmenistan': countryCode = '+993'; break;
      case 'Uganda': countryCode = '+256'; break;
      case 'Ukraine': countryCode = '+380'; break;
      case 'United Arab Emirates': countryCode = '+971'; break;
      case 'Uruguay': countryCode = '+598'; break;
      case 'Uzbekistan': countryCode = '+998'; break;
      case 'Vatican City': countryCode = '+39'; break;
      case 'Venezuela': countryCode = '+58'; break;
      case 'Vietnam': countryCode = '+84'; break;
      case 'Yemen': countryCode = '+967'; break;
      case 'Zambia': countryCode = '+260'; break;
      case 'Zimbabwe': countryCode = '+263'; break;
    }
    
    setShippingInfo(prev => ({
      ...prev,
      country,
      countryCode
    }));
  };

  const subtotal = itemsWithPrices.reduce((total, item) => total + (item.currentPrice * item.quantity), 0);
  const discountedSubtotal = applyDiscount(subtotal);
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const shipping = totalQuantity > 0 ? 8.50 + (Math.max(0, totalQuantity - 1) * 2) : 0;
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
                    <option value="Afghanistan">Afghanistan</option>
                    <option value="Albania">Albania</option>
                    <option value="Algeria">Algeria</option>
                    <option value="Andorra">Andorra</option>
                    <option value="Angola">Angola</option>
                    <option value="Argentina">Argentina</option>
                    <option value="Armenia">Armenia</option>
                    <option value="Australia">Australia</option>
                    <option value="Austria">Austria</option>
                    <option value="Azerbaijan">Azerbaijan</option>
                    <option value="Bahamas">Bahamas</option>
                    <option value="Bahrain">Bahrain</option>
                    <option value="Bangladesh">Bangladesh</option>
                    <option value="Belarus">Belarus</option>
                    <option value="Belgium">Belgium</option>
                    <option value="Belize">Belize</option>
                    <option value="Benin">Benin</option>
                    <option value="Bhutan">Bhutan</option>
                    <option value="Bolivia">Bolivia</option>
                    <option value="Bosnia and Herzegovina">Bosnia and Herzegovina</option>
                    <option value="Botswana">Botswana</option>
                    <option value="Brazil">Brazil</option>
                    <option value="Brunei">Brunei</option>
                    <option value="Bulgaria">Bulgaria</option>
                    <option value="Burkina Faso">Burkina Faso</option>
                    <option value="Burundi">Burundi</option>
                    <option value="Cambodia">Cambodia</option>
                    <option value="Cameroon">Cameroon</option>
                    <option value="Canada">Canada</option>
                    <option value="Cape Verde">Cape Verde</option>
                    <option value="Central African Republic">Central African Republic</option>
                    <option value="Chad">Chad</option>
                    <option value="Chile">Chile</option>
                    <option value="China">China</option>
                    <option value="Colombia">Colombia</option>
                    <option value="Comoros">Comoros</option>
                    <option value="Congo">Congo</option>
                    <option value="Costa Rica">Costa Rica</option>
                    <option value="Croatia">Croatia</option>
                    <option value="Cuba">Cuba</option>
                    <option value="Cyprus">Cyprus</option>
                    <option value="Czech Republic">Czech Republic</option>
                    <option value="Denmark">Denmark</option>
                    <option value="Djibouti">Djibouti</option>
                    <option value="Dominican Republic">Dominican Republic</option>
                    <option value="Ecuador">Ecuador</option>
                    <option value="Egypt">Egypt</option>
                    <option value="El Salvador">El Salvador</option>
                    <option value="Eritrea">Eritrea</option>
                    <option value="Estonia">Estonia</option>
                    <option value="Ethiopia">Ethiopia</option>
                    <option value="Fiji">Fiji</option>
                    <option value="Finland">Finland</option>
                    <option value="France">France</option>
                    <option value="Gabon">Gabon</option>
                    <option value="Gambia">Gambia</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Germany">Germany</option>
                    <option value="Ghana">Ghana</option>
                    <option value="Greece">Greece</option>
                    <option value="Grenada">Grenada</option>
                    <option value="Guatemala">Guatemala</option>
                    <option value="Guinea">Guinea</option>
                    <option value="Guyana">Guyana</option>
                    <option value="Haiti">Haiti</option>
                    <option value="Honduras">Honduras</option>
                    <option value="Hungary">Hungary</option>
                    <option value="Iceland">Iceland</option>
                    <option value="India">India</option>
                    <option value="Indonesia">Indonesia</option>
                    <option value="Iran">Iran</option>
                    <option value="Iraq">Iraq</option>
                    <option value="Ireland">Ireland</option>
                    <option value="Israel">Israel</option>
                    <option value="Italy">Italy</option>
                    <option value="Jamaica">Jamaica</option>
                    <option value="Japan">Japan</option>
                    <option value="Jordan">Jordan</option>
                    <option value="Kazakhstan">Kazakhstan</option>
                    <option value="Kenya">Kenya</option>
                    <option value="Kuwait">Kuwait</option>
                    <option value="Kyrgyzstan">Kyrgyzstan</option>
                    <option value="Laos">Laos</option>
                    <option value="Latvia">Latvia</option>
                    <option value="Lebanon">Lebanon</option>
                    <option value="Lesotho">Lesotho</option>
                    <option value="Liberia">Liberia</option>
                    <option value="Libya">Libya</option>
                    <option value="Liechtenstein">Liechtenstein</option>
                    <option value="Lithuania">Lithuania</option>
                    <option value="Luxembourg">Luxembourg</option>
                    <option value="Madagascar">Madagascar</option>
                    <option value="Malawi">Malawi</option>
                    <option value="Malaysia">Malaysia</option>
                    <option value="Maldives">Maldives</option>
                    <option value="Mali">Mali</option>
                    <option value="Malta">Malta</option>
                    <option value="Mauritania">Mauritania</option>
                    <option value="Mauritius">Mauritius</option>
                    <option value="Mexico">Mexico</option>
                    <option value="Moldova">Moldova</option>
                    <option value="Monaco">Monaco</option>
                    <option value="Mongolia">Mongolia</option>
                    <option value="Montenegro">Montenegro</option>
                    <option value="Morocco">Morocco</option>
                    <option value="Mozambique">Mozambique</option>
                    <option value="Myanmar">Myanmar</option>
                    <option value="Namibia">Namibia</option>
                    <option value="Nepal">Nepal</option>
                    <option value="Netherlands">Netherlands</option>
                    <option value="New Zealand">New Zealand</option>
                    <option value="Nicaragua">Nicaragua</option>
                    <option value="Niger">Niger</option>
                    <option value="Nigeria">Nigeria</option>
                    <option value="North Korea">North Korea</option>
                    <option value="Norway">Norway</option>
                    <option value="Oman">Oman</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="Panama">Panama</option>
                    <option value="Papua New Guinea">Papua New Guinea</option>
                    <option value="Paraguay">Paraguay</option>
                    <option value="Peru">Peru</option>
                    <option value="Philippines">Philippines</option>
                    <option value="Poland">Poland</option>
                    <option value="Portugal">Portugal</option>
                    <option value="Qatar">Qatar</option>
                    <option value="Romania">Romania</option>
                    <option value="Russia">Russia</option>
                    <option value="Rwanda">Rwanda</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="Senegal">Senegal</option>
                    <option value="Serbia">Serbia</option>
                    <option value="Seychelles">Seychelles</option>
                    <option value="Sierra Leone">Sierra Leone</option>
                    <option value="Singapore">Singapore</option>
                    <option value="Slovakia">Slovakia</option>
                    <option value="Slovenia">Slovenia</option>
                    <option value="Somalia">Somalia</option>
                    <option value="South Africa">South Africa</option>
                    <option value="South Korea">South Korea</option>
                    <option value="Spain">Spain</option>
                    <option value="Sri Lanka">Sri Lanka</option>
                    <option value="Sudan">Sudan</option>
                    <option value="Sweden">Sweden</option>
                    <option value="Switzerland">Switzerland</option>
                    <option value="Syria">Syria</option>
                    <option value="Taiwan">Taiwan</option>
                    <option value="Tajikistan">Tajikistan</option>
                    <option value="Tanzania">Tanzania</option>
                    <option value="Thailand">Thailand</option>
                    <option value="Togo">Togo</option>
                    <option value="Tunisia">Tunisia</option>
                    <option value="Turkey">Turkey</option>
                    <option value="Turkmenistan">Turkmenistan</option>
                    <option value="Uganda">Uganda</option>
                    <option value="Ukraine">Ukraine</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States">United States</option>
                    <option value="Uruguay">Uruguay</option>
                    <option value="Uzbekistan">Uzbekistan</option>
                    <option value="Vatican City">Vatican City</option>
                    <option value="Venezuela">Venezuela</option>
                    <option value="Vietnam">Vietnam</option>
                    <option value="Yemen">Yemen</option>
                    <option value="Zambia">Zambia</option>
                    <option value="Zimbabwe">Zimbabwe</option>
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