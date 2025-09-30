import { Trophy, Zap, Clock, Star } from 'lucide-react';
import { FEATURES } from '../../constants';

const iconMap = {
  Trophy,
  Zap,
  Clock,
  Star
};

export function FeaturesBar() {
  return (
    <div className="hidden md:block bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-4 gap-4">
          {FEATURES.map((feature, index) => {
            const Icon = iconMap[feature.icon as keyof typeof iconMap];
            return (
              <div key={index} className="flex items-center justify-center space-x-2">
                <Icon size={20} />
                <span>{feature.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}