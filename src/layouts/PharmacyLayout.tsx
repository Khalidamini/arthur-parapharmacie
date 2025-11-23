import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Home, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Footer from '@/components/Footer';
import PharmacyLogos from '@/components/PharmacyLogos';

interface PharmacyLayoutProps {
  children: ReactNode;
  pharmacyName?: string;
  pharmacyId?: string;
}

const PharmacyLayout = ({ children, pharmacyName, pharmacyId }: PharmacyLayoutProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/pharmacy-login');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <PharmacyLogos pharmacyId={pharmacyId} size="lg" showPharmacyName={false} />
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-xl truncate">Back-Office Pharmacie</h1>
              {pharmacyName && (
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{pharmacyName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/pharmacy-profile')}
              className="px-2 sm:px-3"
            >
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Mon Profil</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')}
              className="px-2 sm:px-3"
            >
              <Home className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Espace Client</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSignOut}
              className="px-2 sm:px-3"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      <Footer />
    </div>
  );
};

export default PharmacyLayout;
