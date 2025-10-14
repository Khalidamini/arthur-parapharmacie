import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { MessageSquare, Tag, QrCode, LogOut, MapPin, Heart, Shield, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [currentPharmacy, setCurrentPharmacy] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Charger la pharmacie référente
        const { data } = await (supabase as any)
          .from('user_pharmacy_affiliation')
          .select('pharmacy_id, pharmacies(name)')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data) {
          setCurrentPharmacy(data.pharmacies?.name || null);
        }
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl bg-gradient-primary bg-clip-text text-transparent">Arthur</span>
          </div>
          <nav className="flex items-center gap-3">
            {user ? (
              <>
                <Button variant="ghost" onClick={() => navigate('/recommendations')}>
                  Mes recommandations
                </Button>
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate('/auth')} className="bg-gradient-primary hover:opacity-90 transition-opacity">
                Se connecter
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
        <div className="max-w-6xl mx-auto px-4 py-24 text-center relative">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary mb-6 shadow-xl animate-in zoom-in duration-500">
            <MessageSquare className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            Bonjour, je suis{' '}
            <span className="bg-gradient-primary bg-clip-text text-transparent">Arthur</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Votre assistant virtuel en parapharmacie. Je vous aide à trouver les produits qui correspondent à vos besoins de santé et de bien-être.
          </p>

          {/* Pharmacie référente */}
          {currentPharmacy && (
            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 mb-8 max-w-md mx-auto">
              <div className="flex items-center gap-2 text-sm justify-center">
                <MapPin className="h-4 w-4 text-primary" />
                <p className="text-muted-foreground">
                  Pharmacie référente : <span className="font-semibold text-foreground">{currentPharmacy}</span>
                </p>
              </div>
            </div>
          )}

          {/* Actions principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-12">
            <Button
              onClick={() => navigate('/chat')}
              className="w-full h-24 bg-gradient-primary border-2 border-primary hover:opacity-90 transition-all group"
            >
              <div className="flex flex-col items-center gap-2">
                <MessageSquare className="h-6 w-6 text-primary-foreground group-hover:scale-110 transition-transform" />
                <span className="font-medium text-primary-foreground">Chat</span>
              </div>
            </Button>
            
            <Button
              onClick={() => navigate('/scan-qr')}
              variant="outline"
              className="w-full h-24 border-2 hover:border-primary/50 transition-all group"
            >
              <div className="flex flex-col items-center gap-2">
                <QrCode className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-medium">Scanner QR</span>
              </div>
            </Button>
            
            <Button
              onClick={() => navigate('/recommendations')}
              variant="outline"
              className="w-full h-24 border-2 hover:border-primary/50 transition-all group"
            >
              <div className="flex flex-col items-center gap-2">
                <Tag className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-medium">Recommandations</span>
              </div>
            </Button>
            
            <Button
              onClick={() => navigate('/pharmacies')}
              variant="outline"
              className="w-full h-24 border-2 hover:border-primary/50 transition-all group"
            >
              <div className="flex flex-col items-center gap-2">
                <MapPin className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-medium">Pharmacies</span>
              </div>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-card p-6 rounded-2xl border-2 border-border shadow-md hover:shadow-lg transition-all hover:border-primary/30 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-4">
              <Heart className="h-6 w-6 text-accent-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Conseils personnalisés</h3>
            <p className="text-muted-foreground">
              Des recommandations adaptées à vos besoins spécifiques en parapharmacie
            </p>
          </div>
          
          <div className="bg-card p-6 rounded-2xl border-2 border-border shadow-md hover:shadow-lg transition-all hover:border-primary/30 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-accent-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Promotions exclusives</h3>
            <p className="text-muted-foreground">
              Accédez aux offres spéciales de votre pharmacie référente
            </p>
          </div>
          
          <div className="bg-card p-6 rounded-2xl border-2 border-border shadow-md hover:shadow-lg transition-all hover:border-primary/30 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-accent-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Expertise professionnelle</h3>
            <p className="text-muted-foreground">
              Des conseils basés sur des connaissances pharmaceutiques fiables
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>© 2024 Arthur - Assistant parapharmacie pour les pharmacies françaises</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;