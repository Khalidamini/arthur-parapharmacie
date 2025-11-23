import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';

interface PharmacyLogosProps {
  pharmacyId?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPharmacyName?: boolean;
}

const PharmacyLogos = ({ pharmacyId, size = 'md', showPharmacyName = false }: PharmacyLogosProps) => {
  const cart = useCart();
  const [pharmacyLogo, setPharmacyLogo] = useState<string | null>(null);
  const [pharmacyName, setPharmacyName] = useState<string | null>(null);

  // Utiliser le pharmacyId fourni ou celui du contexte
  const effectivePharmacyId = pharmacyId || cart.selectedPharmacyId;

  useEffect(() => {
    const loadPharmacyLogo = async () => {
      if (!effectivePharmacyId) {
        setPharmacyLogo(null);
        setPharmacyName(null);
        return;
      }

      const { data } = await supabase
        .from('pharmacies')
        .select('logo_url, name')
        .eq('id', effectivePharmacyId)
        .single();

      if (data) {
        setPharmacyLogo(data.logo_url);
        setPharmacyName(data.name);
      }
    };

    loadPharmacyLogo();
  }, [effectivePharmacyId]);

  const sizes = {
    sm: 'h-6 w-6 sm:h-8 sm:w-8',
    md: 'h-8 w-8 sm:h-10 sm:w-10',
    lg: 'h-10 w-10 sm:h-12 sm:w-12',
    xl: 'h-12 w-12 sm:h-15 sm:w-15'
  };

  return (
    <div className="flex items-center gap-2">
      {/* Logo Arthur (toujours affiché) */}
      <img 
        src="/icon-192.png" 
        alt="Arthur Logo" 
        className={`${sizes[size]} rounded-full shrink-0`}
      />
      
      {/* Logo de la pharmacie (si disponible) */}
      {pharmacyLogo && (
        <img 
          src={pharmacyLogo} 
          alt={`Logo ${pharmacyName || 'pharmacie'}`}
          className={`${sizes[size]} object-contain rounded shrink-0`}
        />
      )}

      {/* Nom de la pharmacie (optionnel) */}
      {showPharmacyName && pharmacyName && (
        <span className="text-sm font-medium truncate">{pharmacyName}</span>
      )}
    </div>
  );
};

export default PharmacyLogos;