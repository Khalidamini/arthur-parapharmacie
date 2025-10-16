import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Footer from '@/components/Footer';

interface PharmacyLayoutProps {
  children: ReactNode;
  pharmacyName?: string;
}

const PharmacyLayout = ({ children, pharmacyName }: PharmacyLayoutProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/pharmacy-login');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-xl">Back-Office Pharmacie</h1>
              {pharmacyName && (
                <p className="text-sm text-muted-foreground">{pharmacyName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')}
            >
              <Home className="mr-2 h-4 w-4" />
              Espace Client
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
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
