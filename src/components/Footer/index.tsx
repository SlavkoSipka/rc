import { Phone, Mail, Facebook, Instagram } from 'lucide-react';
import { FOOTER_SECTIONS } from '../../constants';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-gradient-to-br from-gray-900 to-gray-800 text-white pt-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b border-gray-700">
          <div className="md:col-span-4">
            <Link to="/" className="block mb-6">
              <img src={FOOTER_SECTIONS.LOGO} alt="AIS Like RC" className="h-12" />
            </Link>
            <p className="text-gray-400 mb-6">{FOOTER_SECTIONS.ABOUT.DESCRIPTION}</p>
            <div className="flex space-x-4">
              <a 
                href="https://www.facebook.com/share/15UNWwQDE5/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a 
                href="https://www.instagram.com/customrcparts?igsh=eG9zeXE1dzl6emti"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <h3 className="text-xl font-bold mb-4">{FOOTER_SECTIONS.QUICK_LINKS.TITLE}</h3>
            <ul className="space-y-2">
              {FOOTER_SECTIONS.QUICK_LINKS.LINKS.map((link, index) => (
                <li key={index}>
                  <Link to={link.href} className="text-gray-400 hover:text-white transition-colors">
                    {link.text}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="md:col-span-6">
            <h3 className="text-xl font-bold mb-4">{FOOTER_SECTIONS.CONTACT.TITLE}</h3>
            <ul className="space-y-2 text-gray-400">
              {FOOTER_SECTIONS.CONTACT.ITEMS.map((item, index) => {
                const Icon = item.icon === 'Phone' ? Phone : Mail;
                return (
                  <li key={index} className="flex items-center">
                    <Icon size={16} className="mr-2 text-blue-400" />
                    {item.text}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        
        <div className="py-6 flex flex-col md:flex-row justify-between items-center text-gray-400 text-sm">
          <div>
            © {new Date().getFullYear()} AIS Like RC. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/terms-and-privacy" className="hover:text-white transition-colors">Terms and Privacy</Link>
            <Link to="/about-project" className="hover:text-white transition-colors">About Project</Link>
            <a
              href="https://aisajt.com"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Website by AiSajt
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}