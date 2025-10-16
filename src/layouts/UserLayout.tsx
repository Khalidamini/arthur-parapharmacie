import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { MessageSquare, LogOut, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Footer from '@/components/Footer';

interface UserLayoutProps {
  children: ReactNode;
  user?: any;
}

const UserLayout = ({ children, user }: UserLayoutProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base sm:text-xl bg-gradient-primary bg-clip-text text-transparent">Arthur</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/pharmacy-login')}
              className="text-xs sm:text-sm"
            >
              <Building2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Espace Pharmacien
            </Button>
            {user ? (
              <Button variant="outline" onClick={handleSignOut} className="text-xs sm:text-sm px-2 sm:px-4">
                <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sm:hidden">Sortir</span>
              </Button>
            ) : (
              <Button onClick={() => navigate('/auth')} className="bg-gradient-primary hover:opacity-90 transition-opacity text-xs sm:text-sm px-3 sm:px-4">
                Se connecter
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      <Footer />
    </div>
  );
};

export default UserLayout;
