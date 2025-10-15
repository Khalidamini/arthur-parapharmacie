import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";

const Auth = () => {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate('/');
      }
    };
    checkUser();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode.trim().length !== 8) {
      toast({
        title: "Code invalide",
        description: "Le code doit contenir 8 chiffres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const userEmail = `user-${accessCode.trim()}@app.local`;

      const { error } = await supabase.auth.signUp({
        email: userEmail,
        password: accessCode.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      toast({
        title: "Compte créé",
        description: "Connexion en cours...",
      });

      // Auto-login after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: accessCode.trim(),
      });

      if (signInError) throw signInError;

      navigate('/');
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode.trim().length !== 8) {
      toast({
        title: "Code invalide",
        description: "Le code doit contenir 8 chiffres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const userEmail = `user-${accessCode.trim()}@app.local`;

      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: accessCode.trim(),
      });

      if (error) throw error;

      navigate('/');
    } catch (error: any) {
      toast({
        title: "Erreur de connexion",
        description: "Code d'accès invalide",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary mb-2">
            <MessageSquare className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Arthur
          </h1>
          <p className="text-muted-foreground">Votre assistant parapharmacie</p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle>Bienvenue</CardTitle>
            <CardDescription>Connectez-vous avec votre code à 8 chiffres</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="access-code">Code d'accès</Label>
                    <Input
                      id="access-code"
                      type="text"
                      placeholder="12345678"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ''))}
                      required
                      className="border-2 font-mono text-center text-lg"
                      maxLength={8}
                    />
                    <p className="text-xs text-muted-foreground">
                      Entrez votre code à 8 chiffres
                    </p>
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                    disabled={loading}
                  >
                    {loading ? 'Connexion...' : 'Se connecter'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-code">Choisissez votre code à 8 chiffres</Label>
                    <Input
                      id="signup-code"
                      type="text"
                      placeholder="12345678"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ''))}
                      required
                      className="border-2 font-mono text-center text-lg"
                      maxLength={8}
                    />
                    <p className="text-xs text-muted-foreground">
                      Créez un code à 8 chiffres pour vous connecter
                    </p>
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-gradient-secondary hover:opacity-90 transition-opacity"
                    disabled={loading}
                  >
                    {loading ? 'Création...' : 'Créer mon compte'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
