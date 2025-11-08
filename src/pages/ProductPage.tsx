import { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { SimilarProducts } from '../components/SimilarProducts';
import { ProductGallery } from '../components/Product/ProductGallery';
import { ProductInfo } from '../components/Product/ProductInfo';
import { AddToCartButton } from '../components/Product/AddToCartButton';
import { ShippingNotice } from '../components/Product/ShippingNotice';
import { ProductReviews } from '../components/Product/ProductReviews';
import { CartPanel } from '../components/Cart/CartPanel';
import { useState } from 'react';
import { products } from '../data/products';
import { outletDefectProducts } from '../data/dataOutletDefect';
import { outletUsedProducts } from '../data/dataOutletUsed';
import { useProductStock } from '../hooks/useProductStock';
import { useDiscount } from '../contexts/DiscountContext';

export function ProductPage() {
  const { id } = useParams();
  const location = useLocation();
  const product = products.find(p => p.id === id) || 
                 outletDefectProducts.find(p => p.id === id) ||
                 outletUsedProducts.find(p => p.id === id);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { stock, price, loading, error } = useProductStock(id ?? '');
  const { applyDiscount } = useDiscount();
  const isOutletDefect = outletDefectProducts.some(p => p.id === id);
  const isOutletUsed = outletUsedProducts.some(p => p.id === id);
  const discountPercentage = isOutletDefect ? 50 : isOutletUsed ? 30 : 0;
  const originalPrice = price ?? product?.price ?? 0;
  const discountedPrice = discountPercentage > 0 
    ? originalPrice * (1 - discountPercentage / 100) 
    : originalPrice;

  useEffect(() => {
    if (product) {
      // Update meta tags
      document.title = `${product.title} | Custom RC Parts`;
      
      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', 
          `Buy ${product.title} - Premium quality RC car part. ${product.description || 'High-quality RC car parts and accessories with worldwide shipping from Serbia.'}`
        );
      }
      
      // Update Open Graph tags
      const ogTitle = document.querySelector('meta[property="og:title"]');
      const ogDesc = document.querySelector('meta[property="og:description"]');
      const ogUrl = document.querySelector('meta[property="og:url"]');
      const ogImage = document.querySelector('meta[property="og:image"]');
      
      if (ogTitle) ogTitle.setAttribute('content', `${product.title} | Custom RC Parts`);
      if (ogDesc) ogDesc.setAttribute('content', product.description || 'High-quality RC car parts and accessories');
      if (ogUrl) ogUrl.setAttribute('content', `https://customrc.parts${location.pathname}`);
      if (ogImage) ogImage.setAttribute('content', product.image);
      
      // Update Twitter tags
      const twitterTitle = document.querySelector('meta[property="twitter:title"]');
      const twitterDesc = document.querySelector('meta[property="twitter:description"]');
      const twitterImage = document.querySelector('meta[property="twitter:image"]');
      
      if (twitterTitle) twitterTitle.setAttribute('content', `${product.title} | Custom RC Parts`);
      if (twitterDesc) twitterDesc.setAttribute('content', product.description || 'High-quality RC car parts and accessories');
      if (twitterImage) twitterImage.setAttribute('content', product.image);
      
      // Add product structured data
      const existingStructuredData = document.querySelector('#product-structured-data');
      if (existingStructuredData) {
        existingStructuredData.remove();
      }
      
      const script = document.createElement('script');
      script.id = 'product-structured-data';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        image: product.images || [product.image],
        description: product.description || 'High-quality RC car part',
        sku: product.id,
        brand: {
          '@type': 'Brand',
          name: product.title.split(' ')[0] // First word is usually the brand (Tamiya, Yokomo, etc.)
        },
        offers: {
          '@type': 'Offer',
          url: `https://customrc.parts${location.pathname}`,
          priceCurrency: 'EUR',
          price: discountedPrice,
          availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: 'Custom RC Parts'
          }
        }
      });
      document.head.appendChild(script);
      
      // Send page view to Google Analytics
      window.gtag('event', 'view_item', {
        currency: 'EUR',
        value: discountedPrice,
        items: [{
          item_id: product.id,
          item_name: product.title,
          price: discountedPrice,
          currency: 'EUR'
        }]
      });
    }
    
    // Cleanup function
    return () => {
      const structuredData = document.querySelector('#product-structured-data');
      if (structuredData) {
        structuredData.remove();
      }
    };
  }, [product, price, stock, location.pathname]);

  if (!product) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h1>
            <p className="text-gray-600">The product you're looking for doesn't exist.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const productImages = product.images || [product.image];

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              <ProductGallery 
                images={productImages}
                title={product.title}
                price={price ? applyDiscount(price) : originalPrice}
              />
              
              <div className="space-y-6">
                <ProductInfo
                  title={product.title}
                 price={price ? applyDiscount(price) : (product.price ? applyDiscount(product.price) : 0)}
                  originalPrice={discountPercentage > 0 ? originalPrice : undefined}
                  discountPercentage={discountPercentage}
                  color={product.color}
                  description={product.description}
                  condition={product.condition}
                  shipping={product.shipping}
                  location={product.location}
                  stock={stock ?? 0}
                />
                
                <div className="pt-6 border-t">
                  {loading ? (
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 py-3 px-8 rounded-full font-medium bg-gray-200 text-gray-500 cursor-wait"
                    >
                      Checking Stock...
                    </button>
                  ) : error ? (
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 py-3 px-8 rounded-full font-medium bg-red-100 text-red-500 cursor-not-allowed"
                    >
                      Error Loading Stock
                    </button>
                  ) : stock && stock > 0 ? (
                    <AddToCartButton product={product} onCartOpen={() => setIsCartOpen(true)} />
                  ) : (
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 py-3 px-8 rounded-full font-medium bg-gray-200 text-gray-500 cursor-not-allowed"
                    >
                      Out of Stock
                    </button>
                  )}
                </div>
              </div>
            </div>
          
            <div className="mt-12">
              <ShippingNotice />
            </div>

            <ProductReviews productId={product.id} />
          </div>

          <div className="mt-16">
            <SimilarProducts
              currentProductId={product.id}
              products={products}
            />
          </div>
        </div>
      </div>
      <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <Footer />
    </>
  );
}