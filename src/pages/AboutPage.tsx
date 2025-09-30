import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Users, Trophy, Clock, MapPin, Zap } from 'lucide-react';

export function AboutPage() {
  return (
    <>
      <div className="min-h-screen relative">
        <div 
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: 'url(http://aislike.rs/pozadina/bora.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        />
        
        <div className="relative z-10">
          <Header />
          <div className="min-h-screen bg-white/90">
            <div 
              className="relative text-white py-48"
              style={{
                backgroundImage: 'url(http://aislike.rs/rc/pozadina/bora.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed'
              }}
            >
              <div className="absolute inset-0 bg-black/50" />
              <div className="container mx-auto px-4">
                <h1 className="relative z-10 text-5xl md:text-7xl font-bold mb-8">Custom RC Parts</h1>
                <p className="relative z-10 text-2xl text-gray-100 max-w-3xl">
                  A family-run business dedicated to designing and producing premium RC parts 
                  that combine stunning aesthetics with superior functionality.
                </p>
              </div>
            </div>

            {/* Stats Section */}
            <div className="container mx-auto px-4 py-16">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-sm text-center">
                  <Users className="w-10 h-10 text-blue-600 mx-auto mb-4" />
                  <div className="text-3xl font-bold text-gray-900 mb-2">5000+</div>
                  <div className="text-gray-600">Happy Customers</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm text-center">
                  <Trophy className="w-10 h-10 text-blue-600 mx-auto mb-4" />
                  <div className="text-3xl font-bold text-gray-900 mb-2">100+</div>
                  <div className="text-gray-600">Products</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm text-center">
                  <Clock className="w-10 h-10 text-blue-600 mx-auto mb-4" />
                  <div className="text-3xl font-bold text-gray-900 mb-2">8</div>
                  <div className="text-gray-600">Years Experience</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm text-center">
                  <MapPin className="w-10 h-10 text-blue-600 mx-auto mb-4" />
                  <div className="text-3xl font-bold text-gray-900 mb-2">50+</div>
                  <div className="text-gray-600">Countries Served</div>
                </div>
              </div>
            </div>

            {/* Story Section */}
            <div className="relative py-24 overflow-hidden bg-blue-50">
              <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div className="relative">
                    <div className="absolute -top-6 -left-6 w-24 h-24 bg-blue-600/10 rounded-full" />
                    <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-blue-600/10 rounded-full" />
                    <div className="relative">
                      <img
                        src="https://aislike.rs/rc/143.webp"
                        alt="RC Part Manufacturing"
                        className="w-full h-[400px] object-cover rounded-2xl shadow-2xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-2xl" />
                    </div>
                  </div>
                  
                  <div className="relative z-10">
                    <h2 className="text-4xl font-bold text-gray-900 mb-8 leading-tight">
                      Our Story: From Workshop to{' '}
                      <span className="text-blue-600">Global Excellence</span>
                    </h2>
                    <div className="space-y-6 text-lg text-gray-600">
                      <p className="relative pl-6 before:content-[''] before:absolute before:left-0 before:top-0 before:w-1 before:h-full before:bg-blue-600/30 before:rounded-full">
                        Custom RC Parts is a small family run business that loves RC. Based in the beautiful 
                        town of Vrnjacka Banja in Serbia, our business is based around machine fabrication 
                        and we have extended this to designing and producing RC parts that not only look 
                        fantastic but function much better than the original.
                      </p>
                      <p className="relative pl-6 before:content-[''] before:absolute before:left-0 before:top-0 before:w-1 before:h-full before:bg-blue-600/30 before:rounded-full">
                        Our family loves RC and we love driving them hard even more, which creates a great 
                        opportunity to personally test our parts in the field. Most importantly, our products 
                        are supplied to racers around the world that test our parts on the race track and in 
                        the field under the severest conditions ensuring that the parts we supply to you are 
                        of the highest standard.
                      </p>
                      <p className="relative pl-6 before:content-[''] before:absolute before:left-0 before:top-0 before:w-1 before:h-full before:bg-blue-600/30 before:rounded-full">
                        All of our parts are CAD designed and machined using our state of the art CNC mill, 
                        after production each part is individually inspected to ensure its precision and 
                        quality is perfect. We also fabricate one off pieces for that special build.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Values Section */}
            <div className="relative py-24 overflow-hidden bg-gradient-to-br from-blue-50 via-white to-gray-50">
              <div className="absolute inset-0 bg-grid-pattern opacity-5" />
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
              <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                  <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Values</h2>
                  <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-blue-600 mx-auto rounded-full" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Trophy className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">Quality First</h3>
                    <p className="text-gray-600 leading-relaxed">
                      We never compromise on quality. Every part we sell is manufactured to precise 
                      specifications using premium materials and undergoes rigorous quality control.
                    </p>
                  </div>
                  <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Users className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">Customer Focus</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Your satisfaction is our priority. We provide detailed product information, 
                      responsive support, and hassle-free shopping experience.
                    </p>
                  </div>
                  <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Zap className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">Innovation</h3>
                    <p className="text-gray-600 leading-relaxed">
                      We continuously expand our product line with innovative solutions that 
                      enhance the performance and reliability of your RC vehicles.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}