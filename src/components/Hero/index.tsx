import { Link } from 'react-router-dom';
import { HERO } from '../../constants';

export function Hero() {
  return (
    <div className="relative">
      <img 
        src={HERO.IMAGE}
        alt="RC Car Racing"
        className="w-full h-[600px] object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/40 flex items-center">
        <div className="container mx-auto px-4">
          <h1 className="text-white text-4xl md:text-6xl font-bold mb-4">
            {HERO.TITLE}
          </h1>
          <p className="text-white text-xl mb-8">
            {HERO.SUBTITLE}
          </p>
          <Link 
            to="/about"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all transform hover:scale-105"
          >
            About Us
          </Link>
        </div>
      </div>
    </div>
  );
}