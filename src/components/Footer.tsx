import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, User, Home, Package, LayoutDashboard, Truck, LucideIcon } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
interface FooterLink {
  to: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  badge?: number;
}
const Footer = () => {
  const location = useLocation();
  const {
    totalItems
  } = useCart();
  const [isPharmacist, setIsPharmacist] = useState<boolean | null>(null);
  useEffect(() => {
    const checkPharmacistRole = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        const {
          data: roles
        } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
        setIsPharmacist(!!roles);
      } else {
        setIsPharmacist(false);
      }
    };
    checkPharmacistRole();
  }, []);
  if (location.pathname.startsWith('/checkout')) return null;
  if (location.pathname.startsWith('/pharmacy')) return null;

  // Ne rien afficher pendant le chargement
  if (isPharmacist === null) return null;
  const pharmacyLinks: FooterLink[] = [{
    to: '/pharmacy-dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    isActive: location.pathname === '/pharmacy-dashboard'
  }, {
    to: '/pharmacy-pickup-orders',
    icon: Package,
    label: 'À Emporter',
    isActive: location.pathname === '/pharmacy-pickup-orders'
  }, {
    to: '/pharmacy-delivery-orders',
    icon: Truck,
    label: 'Livraisons',
    isActive: location.pathname === '/pharmacy-delivery-orders'
  }, {
    to: '/pharmacy-profile',
    icon: User,
    label: 'Mon Profil',
    isActive: location.pathname === '/pharmacy-profile'
  }];
  const clientLinks: FooterLink[] = [{
    to: '/',
    icon: Home,
    label: 'Accueil',
    isActive: location.pathname === '/'
  }, {
    to: '/shop',
    icon: ShoppingBag,
    label: 'Boutique',
    isActive: location.pathname === '/shop'
  }, {
    to: '/cart',
    icon: ShoppingCart,
    label: 'Mon panier',
    badge: totalItems,
    isActive: location.pathname === '/cart'
  }, {
    to: '/my-orders',
    icon: Package,
    label: 'Mes commandes',
    isActive: location.pathname === '/my-orders'
  }, {
    to: '/recommendations?tab=account',
    icon: User,
    label: 'Mon compte',
    isActive: location.pathname === '/recommendations' && location.search.includes('tab=account')
  }];
  const links = isPharmacist ? pharmacyLinks : clientLinks;
  return <footer className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-lg">
      <div className="container max-w-3xl mx-auto mb-0 pb-0">
        <div className={`grid gap-0.5 ${isPharmacist ? 'grid-cols-4' : 'grid-cols-5'}`}>
          {links.map(link => {
          const Icon = link.icon;
          return <Link key={link.to} to={link.to} className={`flex flex-col items-center justify-center py-2 sm:py-3 transition-colors relative ${link.isActive ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
                <Icon className={`h-5 w-5 sm:h-5 sm:w-5 mb-0.5 sm:mb-1 ${link.isActive ? 'stroke-[2.5]' : ''}`} />
                {link.badge !== undefined && link.badge > 0 && <span className="absolute top-1 right-1/4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {link.badge}
                  </span>}
                <span className="text-[10px] sm:text-xs font-medium leading-tight text-center px-0.5 max-w-full line-clamp-2">
                  {link.label}
                </span>
              </Link>;
        })}
        </div>
      </div>
    </footer>;
};
export default Footer;