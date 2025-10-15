import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";

const Auth = () => {
  const [accessCode, setAccessCode] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [isPregnant, setIsPregnant] = useState(false);
  const [allergies, setAllergies] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [signupUsername, setSignupUsername] = useState('');
  const [signinUsername, setSigninUsername] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate('/');
      }
    };
    checkUser();
  }, [navigate]);

  // Si l'utilisateur arrive via un lien QR externe (ex: /auth?code=PH-XXXX)
  // pré-enregistre la pharmacie référente pour l'appliquer après inscription/connexion
  useEffect(() => {
    const code = searchParams.get('code') || searchParams.get('qr') || searchParams.get('pharmacy') || searchParams.get('ref');
    if (!code) return;

    (async () => {
      const { data, error } = await (supabase as any)
        .from('pharmacies')
        .select('id,name')
        .eq('qr_code', code)
        .maybeSingle();

      if (error) {
        console.error('QR param pharmacy lookup error:', error);
        toast({ title: 'QR invalide', description: "Aucune pharmacie trouvée pour ce code", variant: 'destructive' });
        return;
      }

      if (data) {
        localStorage.setItem('pending_pharmacy_affiliation', JSON.stringify({
          pharmacy_id: data.id,
          affiliation_type: 'permanent',
        }));
        toast({ title: 'Pharmacie détectée', description: `${data.name} sera définie comme référente après inscription` });
      } else {
        toast({ title: 'QR invalide', description: "Aucune pharmacie trouvée pour ce code", variant: 'destructive' });
      }
    })();
  }, [searchParams, toast]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = signupUsername.trim().toLowerCase();

    // Validations
    if (!cleanUsername) {
      toast({ title: "Login manquant", description: "Veuillez choisir un login", variant: "destructive" });
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      toast({ title: "Login invalide", description: "3-20 caractères, lettres/chiffres/underscore uniquement", variant: "destructive" });
      return;
    }
    if (accessCode.trim().length !== 8) {
      toast({ title: "Code invalide", description: "Le code doit contenir 8 chiffres", variant: "destructive" });
      return;
    }

    if (!gender || !age) {
      toast({
        title: "Informations manquantes",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const userEmail = `${cleanUsername}@app.local`;

      const { data: authData, error } = await supabase.auth.signUp({
        email: userEmail,
        password: accessCode.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // Mettre à jour le profil avec les informations médicales
      if (authData.user) {
        const { error: profileError } = await (supabase as any)
          .from('profiles')
          .update({
            gender,
            age: parseInt(age),
            is_pregnant: gender === 'femme' ? isPregnant : false,
            allergies: allergies.trim() || null,
            medical_history: medicalHistory.trim() || null,
            username: signupUsername.trim().toLowerCase(),
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          toast({ title: 'Login déjà pris', description: 'Veuillez choisir un autre login', variant: 'destructive' });
          throw profileError;
        }
      }

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

      // Vérifier s'il y a une affiliation de pharmacie en attente
      const pendingAffiliation = localStorage.getItem('pending_pharmacy_affiliation');
      if (pendingAffiliation && authData.user) {
        const { pharmacy_id, affiliation_type } = JSON.parse(pendingAffiliation);
        
        try {
          await (supabase as any)
            .from('user_pharmacy_affiliation')
            .insert({
              user_id: authData.user.id,
              pharmacy_id,
              affiliation_type
            });
          
          localStorage.removeItem('pending_pharmacy_affiliation');
          
          toast({
            title: "Affiliation réussie",
            description: "Votre pharmacie référente a été enregistrée",
          });
        } catch (affiliationError) {
          console.error('Error creating pending affiliation:', affiliationError);
        }
      }

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
    const cleanUsername = signinUsername.trim().toLowerCase();

    if (!cleanUsername) {
      toast({ title: 'Login manquant', description: 'Veuillez entrer votre login', variant: 'destructive' });
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      toast({ title: 'Login invalide', description: '3-20 caractères, lettres/chiffres/underscore uniquement', variant: 'destructive' });
      return;
    }
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
      const userEmail = `${cleanUsername}@app.local`;

      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: accessCode.trim(),
      });

      if (error) throw error;

      // Vérifier s'il y a une affiliation de pharmacie en attente
      const pendingAffiliation = localStorage.getItem('pending_pharmacy_affiliation');
      if (pendingAffiliation) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { pharmacy_id, affiliation_type } = JSON.parse(pendingAffiliation);
          
          try {
            await (supabase as any)
              .from('user_pharmacy_affiliation')
              .insert({
                user_id: user.id,
                pharmacy_id,
                affiliation_type
              });
            
            localStorage.removeItem('pending_pharmacy_affiliation');
            
            toast({
              title: "Affiliation réussie",
              description: "Votre pharmacie référente a été enregistrée",
            });
          } catch (affiliationError) {
            console.error('Error creating pending affiliation:', affiliationError);
          }
        }
      }

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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-username">Login</Label>
                    <Input
                      id="signin-username"
                      type="text"
                      placeholder="votrelogin"
                      value={signinUsername}
                      onChange={(e) => setSigninUsername(e.target.value.toLowerCase())}
                      required
                      className="border-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Votre nom d'utilisateur
                    </p>
                  </div>

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
                    <Label htmlFor="signup-username">Login *</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="votrelogin"
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value.toLowerCase())}
                      required
                      className="border-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      3-20 caractères (lettres, chiffres, underscore)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-code">Choisissez votre code à 8 chiffres *</Label>
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
                  </div>

                  <div className="space-y-2">
                    <Label>Sexe *</Label>
                    <RadioGroup value={gender} onValueChange={setGender} required>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="homme" id="homme" />
                        <Label htmlFor="homme" className="font-normal cursor-pointer">Homme</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="femme" id="femme" />
                        <Label htmlFor="femme" className="font-normal cursor-pointer">Femme</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="autre" id="autre" />
                        <Label htmlFor="autre" className="font-normal cursor-pointer">Autre</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Âge *</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="25"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                      min="0"
                      max="150"
                    />
                  </div>

                  {gender === 'femme' && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="pregnant"
                          checked={isPregnant}
                          onChange={(e) => setIsPregnant(e.target.checked)}
                          className="rounded border-input"
                        />
                        <Label htmlFor="pregnant" className="font-normal cursor-pointer">
                          Je suis enceinte
                        </Label>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="allergies">Allergies</Label>
                    <Textarea
                      id="allergies"
                      placeholder="Listez vos allergies connues..."
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medical-history">Antécédents médicaux</Label>
                    <Textarea
                      id="medical-history"
                      placeholder="Indiquez vos antécédents médicaux importants..."
                      value={medicalHistory}
                      onChange={(e) => setMedicalHistory(e.target.value)}
                      className="min-h-[60px]"
                    />
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
