import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { MessageSquare, Heart, Shield, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

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
          <div className="flex gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            {user ? (
              <Button 
                size="lg" 
                onClick={() => navigate('/chat')}
                className="bg-gradient-primary hover:opacity-90 transition-all shadow-lg hover:shadow-xl px-8"
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                Démarrer un chat
              </Button>
            ) : (
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="bg-gradient-primary hover:opacity-90 transition-all shadow-lg hover:shadow-xl px-8"
              >
                Commencer
              </Button>
            )}
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
