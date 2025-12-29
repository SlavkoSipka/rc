import { ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { Product } from '../../types';
import { useProductStock } from '../../hooks/useProductStock';
import { useCart } from '../../contexts/CartContext';

interface AddToCartButtonProps {
  product: Product;
  onCartOpen?: () => void;
}

export function AddToCartButton({ product, onCartOpen }: AddToCartButtonProps) {
  const { addToCart, items } = useCart();
  const { stock } = useProductStock(product.id);
  const [isAdding, setIsAdding] = useState(false);

  const cartItem = items.find(item => item.id === product.id);
  const isMaxQuantity = cartItem && stock !== null && cartItem.quantity >= stock;
  const isOutOfStock = stock === 0;

  const handleAddToCart = () => {
    if (isMaxQuantity || isOutOfStock) return;
    setIsAdding(true);
    addToCart({ ...product, stock });
    if (onCartOpen) {
      onCartOpen();
    }
    
    setTimeout(() => {
      setIsAdding(false);
    }, 1000);
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={isAdding || isMaxQuantity || isOutOfStock}
      className={`w-full flex items-center justify-center gap-2 py-3 px-8 rounded-full font-medium transition-all ${
        isAdding
          ? 'bg-green-600 text-white'
          : isOutOfStock
          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
          : isMaxQuantity
          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      <ShoppingCart className="w-5 h-5" />
      {isAdding ? 'Added to Cart!' : isOutOfStock ? 'Out of Stock' : isMaxQuantity ? 'Maximum Quantity in Cart' : 'Add to Cart'}
    </button>
  );
}