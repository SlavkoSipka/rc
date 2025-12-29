import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Code, Zap, ShoppingCart, Search, TrendingUp } from 'lucide-react';

export function ProjectPage() {
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                About the Project
              </h1>
              <p className="text-xl text-gray-600">
                How the RC parts e-commerce website was created
              </p>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-8">
              <div className="prose prose-lg max-w-none">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">About the Client</h2>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  Custom RC Parts is a family-run business from Vrnjačka Banja that specializes in designing and 
                  manufacturing premium parts for RC cars. With over 8 years of experience and more than 5,000 
                  satisfied customers worldwide, the company needed a modern, fast, and functional e-commerce website 
                  that would enable simple online sales of their products.
                </p>

                <h2 className="text-2xl font-bold text-gray-900 mb-6 mt-8">Project Goals</h2>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  The main goal was to create a website that would provide an excellent user experience, enable fast 
                  and simple product search, and ensure a secure purchasing process. The site needed to be optimized 
                  for different devices, with a focus on loading speed and intuitive navigation. It was also important 
                  to implement an inventory management system and payment system integration.
                </p>

                <h2 className="text-2xl font-bold text-gray-900 mb-6 mt-8">What Was Done</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <Code className="w-8 h-8 text-blue-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Design and Development</h3>
                    <p className="text-gray-700 leading-relaxed">
                      A modern, responsive design was created that excellently showcases the products. The website was 
                      developed using the latest technologies for speed and performance. A complex image gallery, 
                      detailed product pages with specifications, and optimized search that enables quick finding of 
                      desired parts were implemented.
                    </p>
                  </div>

                  <div className="bg-green-50 p-6 rounded-lg">
                    <Zap className="w-8 h-8 text-green-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Performance</h3>
                    <p className="text-gray-700 leading-relaxed">
                      The website was optimized for maximum loading speed. Lazy loading for images, CSS and JavaScript 
                      optimization, and efficient caching were implemented. The result is a website that loads in less 
                      than 2 seconds, significantly improving user experience and positively impacting SEO.
                    </p>
                  </div>

                  <div className="bg-purple-50 p-6 rounded-lg">
                    <ShoppingCart className="w-8 h-8 text-purple-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-3">E-commerce Functionality</h3>
                    <p className="text-gray-700 leading-relaxed">
                      A complete online sales system was implemented with a shopping cart, PayPal payment system 
                      integration, and automatic inventory management. Users can easily search for products by categories, 
                      filter results, and add products to the cart with detailed shipping information.
                    </p>
                  </div>

                  <div className="bg-orange-50 p-6 rounded-lg">
                    <Search className="w-8 h-8 text-orange-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-3">SEO Optimization</h3>
                    <p className="text-gray-700 leading-relaxed">
                      The website was optimized for search engines with properly structured meta tags, semantic HTML, 
                      and optimized URL structures. A sitemap.xml and robots.txt were implemented for better indexing. 
                      All pages are optimized with relevant keywords and descriptive alt texts for images.
                    </p>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6 mt-8">Concrete Results</h2>
                <p className="text-gray-700 mb-4 leading-relaxed">
                  After implementation, the website achieved significant results. Loading speed was improved by over 60% 
                  compared to the previous version, which directly impacted reducing bounce rate and increasing time spent 
                  on the site. Users can now quickly find desired products thanks to advanced search and filtering.
                </p>
                <p className="text-gray-700 mb-4 leading-relaxed">
                  The purchasing process has been significantly simplified, with clear steps from search to order 
                  finalization. Payment system integration enables secure transactions, and automatic inventory management 
                  prevents sales of unavailable products. All of this has contributed to increased conversions and 
                  customer satisfaction.
                </p>

                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg my-8">
                  <div className="flex items-start">
                    <TrendingUp className="w-6 h-6 text-blue-600 mr-4 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">UX Improvements</h3>
                      <p className="text-gray-700 leading-relaxed">
                        Responsive design enables an excellent experience on all devices - from desktop computers to 
                        mobile phones. Intuitive navigation and clear page structure make the website accessible to all 
                        users, regardless of their technical knowledge.
                      </p>
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6 mt-8">Conclusion</h2>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  This project successfully combined modern design, fast performance, and functional e-commerce 
                  capabilities. The website now provides an excellent user experience and enables Custom RC Parts to 
                  efficiently sell their products online. The partnership with the <a href="https://aisajt.com" className="text-blue-600 hover:text-blue-800 font-medium">AiSajt</a> team 
                  was crucial for achieving these results, as they provided the expertise in 
                  <a href="https://aisajt.com/izrada-sajtova" className="text-blue-600 hover:text-blue-800 font-medium"> web design and development</a> necessary for creating such a complex e-commerce solution.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  The website is now ready for further growth and scaling, with possibilities for adding new 
                  functionalities and expanding the product catalog in the future.
                </p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
