import { Package, Truck } from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { useDiscount } from '../../contexts/DiscountContext';

interface ProductInfoProps {
  title: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  color?: string;
  description?: string;
  condition?: string;
  shipping?: string;
  location?: string;
  stock: number;
}

export function ProductInfo({ 
  title, 
  price, 
  originalPrice, 
  discountPercentage,
  color, 
  description, 
  condition = 'New', 
  shipping = 'Standard International Shipping', 
  location = 'Serbia', 
  stock 
}: ProductInfoProps) {
  const { applyDiscount } = useDiscount();
  const discountedPrice = applyDiscount(price);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      
      <div className="flex items-baseline gap-4">
        <div className="flex flex-col">
          <span className="text-3xl font-bold text-blue-600">
            €{formatPrice(originalPrice || price)}
          </span>
        </div>
        <span className="text-sm text-gray-500">+ €8.50 shipping</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className={`inline-block w-3 h-3 rounded-full ${stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className={`font-medium ${stock > 0 ? 'text-green-700' : 'text-red-700'}`}>
          {stock > 0 ? `In Stock (${stock} available)` : 'Out of Stock'}
        </span>
      </div>
      
      {(color || description) && (
        <div className="space-y-4">
          {color && (
            <div>
              <p className="font-medium mb-1">Color</p>
              <p className="text-gray-600 flex items-center gap-2">
                <span className={`inline-block w-6 h-6 rounded-full shadow-sm border ${
                  color.toLowerCase() === 'blue' ? 'bg-blue-600' :
                  color.toLowerCase() === 'red' ? 'bg-red-600' :
                  color.toLowerCase() === 'black' ? 'bg-black' :
                  color.toLowerCase() === 'silver' ? 'bg-gray-400' :
                  'bg-gray-300'
                }`} />
                {color}
              </p>
            </div>
          )}
          {description && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Item description from the seller</h2>
              <div className="text-gray-600 leading-relaxed space-y-6">
                {description.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-gray-400" />
          <div>
            <p className="font-medium">Condition</p>
            <p className="text-gray-600">{condition}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-gray-400" />
          <div>
            <p className="font-medium">Shipping</p>
            <p className="text-gray-600">{shipping}</p>
            <p className="text-sm text-gray-500">From {location}</p>
          </div>
        </div>
      </div>
    </div>
  );
}