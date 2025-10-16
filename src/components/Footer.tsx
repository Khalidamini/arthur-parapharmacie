import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, User, MapPin } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

const Footer = () => {
  const location = useLocation();
  const { totalItems } = useCart();
  
  const links = [
    { 
      to: '/shop', 
      icon: ShoppingBag, 
      label: 'Boutique',
      isActive: location.pathname === '/shop'
    },
    { 
      to: '/cart', 
      icon: ShoppingCart, 
      label: 'Mon panier',
      badge: totalItems,
      isActive: location.pathname === '/cart'
    },
    { 
      to: '/recommendations?tab=account', 
      icon: User, 
      label: 'Mon compte',
      isActive: location.pathname === '/recommendations' && location.search.includes('tab=account')
    },
    { 
      to: '/pharmacies', 
      icon: MapPin, 
      label: 'Pharmacies',
      isActive: location.pathname === '/pharmacies'
    },
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-lg">
      <div className="container max-w-3xl mx-auto">
        <div className="grid grid-cols-4 gap-0.5">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex flex-col items-center justify-center py-2 sm:py-3 transition-colors relative ${
                  link.isActive
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Icon className={`h-5 w-5 sm:h-5 sm:w-5 mb-0.5 sm:mb-1 ${link.isActive ? 'stroke-[2.5]' : ''}`} />
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="absolute top-1 right-1/4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {link.badge}
                  </span>
                )}
                <span className="text-[10px] sm:text-xs font-medium leading-tight text-center px-0.5 max-w-full line-clamp-2">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
