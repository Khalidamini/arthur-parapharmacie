import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, ArrowLeft } from "lucide-react";
import Footer from '@/components/Footer';

const PharmacyLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Vérifier si l'utilisateur a un rôle de pharmacien
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role, pharmacy_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roles) {
          navigate('/pharmacy-dashboard');
        } else {
          // Utilisateur connecté mais pas pharmacien
          navigate('/');
        }
      }
    };
    checkUser();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;

      if (data.user) {
        // Après connexion, vérifier et attribuer les invitations en attente
        try {
          await supabase.functions.invoke('claim-team-invitations');
        } catch (claimError) {
          console.error('Error claiming invitations:', claimError);
        }

        // Vérifier si l'utilisateur a un rôle de pharmacien
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role, pharmacy_id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (rolesError) {
          console.error('Error checking roles:', rolesError);
        }

        if (!roles) {
          // Pas de rôle pharmacien trouvé
          await supabase.auth.signOut();
          toast({
            title: "Accès refusé",
            description: "Ce compte n'est pas associé à une pharmacie",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Connexion réussie",
          description: "Redirection vers votre tableau de bord...",
        });

        navigate('/pharmacy-dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Erreur de connexion",
        description: "Email ou mot de passe incorrect",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4 pb-24">
      <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Retour à l'accueil</span>
          </Link>
          
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary mb-2">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Espace Pharmaciens
          </h1>
          <p className="text-muted-foreground">Connectez-vous à votre tableau de bord</p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Accédez à la gestion de votre pharmacie
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre.email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-2"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-2"
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center justify-end">
                <Link 
                  to="/pharmacy-reset-password" 
                  className="text-sm text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              
              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Pas encore inscrit ?
                </p>
                <Link to="/pharmacy-register">
                  <Button variant="outline" className="w-full">
                    Inscrire ma pharmacie
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default PharmacyLogin;
