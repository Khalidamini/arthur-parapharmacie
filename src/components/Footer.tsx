import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Package, User, MapPin } from 'lucide-react';

const Footer = () => {
  const location = useLocation();
  
  const links = [
    { 
      to: '/recommendations', 
      icon: MessageSquare, 
      label: 'Historique chats',
      isActive: location.pathname === '/recommendations'
    },
    { 
      to: '/recommendations?tab=products', 
      icon: Package, 
      label: 'Produits recommandés',
      isActive: location.pathname === '/recommendations' && location.search.includes('tab=products')
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
      <div className="container max-w-4xl mx-auto">
        <div className="grid grid-cols-4 gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex flex-col items-center justify-center py-3 transition-colors ${
                  link.isActive
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Icon className={`h-5 w-5 mb-1 ${link.isActive ? 'stroke-[2.5]' : ''}`} />
                <span className="text-xs font-medium truncate px-1">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
