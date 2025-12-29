import { Link } from 'react-router-dom';
import { ShoppingCart, Heart } from 'lucide-react';
import { useProductStock } from '../hooks/useProductStock';
import { formatPrice } from '../utils/format';
import { useDiscount } from '../contexts/DiscountContext';

interface ProductCardProps {
  image: string;
  title: string;
  id: string;
  stock: number;
}

export function ProductCard({ image, title, id, stock }: ProductCardProps) {
  const { stock: realStock, price } = useProductStock(id);
  const { applyDiscount } = useDiscount();

  return (
    <div className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
      <Link to={`/product/${id}`} className="block relative">
        <div className="aspect-square overflow-hidden">
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
            aria-label="Add to wishlist"
          >
            <Heart size={20} className="text-gray-600" />
          </button>
          <button 
            className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
            aria-label="Add to cart"
          >
            <ShoppingCart size={20} className="text-gray-600" />
          </button>
        </div>
      </Link>
      <div className="p-4">
        <Link to={`/product/${id}`} className="block">
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 hover:text-blue-600 transition-colors">
            {title}
          </h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-lg font-bold text-blue-600">
                  {price ? `€${formatPrice(applyDiscount(price))}` : ''}
                </span>
                <span className="text-xs text-gray-500">+ shipping from €8.50</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${realStock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-sm text-gray-600">{realStock > 0 ? 'In Stock' : 'Out of Stock'}</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}