import { Mail, Facebook, Instagram, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CONTACT } from '../../constants';

export function TopBar() {
  return (
    <div className="bg-black text-white py-2">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Mail size={16} />
              <span className="text-sm">{CONTACT.EMAIL}</span>
            </div>
            <Link to="/about" className="flex items-center gap-2 hover:text-gray-300 transition-colors">
              <Info size={16} />
              <span className="text-sm">About Us</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://www.facebook.com/share/15UNWwQDE5/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors"
            >
              <Facebook size={16} />
            </a>
            <a 
              href="https://www.instagram.com/customrcparts?igsh=eG9zeXE1dzl6emti"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors"
            >
              <Instagram size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}