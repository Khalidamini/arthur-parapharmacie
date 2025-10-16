import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";
import Footer from '@/components/Footer';

const PharmacyRegister = () => {
  const [pharmacyName, setPharmacyName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (password !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Créer le compte utilisateur
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: ownerEmail,
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/pharmacy-dashboard`,
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Créer la demande d'inscription de la pharmacie
        const { error: registrationError } = await supabase
          .from('pharmacy_registrations')
          .insert({
            pharmacy_name: pharmacyName,
            address,
            city,
            postal_code: postalCode,
            phone: phone || null,
            owner_email: ownerEmail,
            owner_name: ownerName,
            status: 'pending',
          });

        if (registrationError) throw registrationError;

        toast({
          title: "Demande envoyée",
          description: "Votre demande d'inscription a été envoyée. Vous recevrez un email de confirmation une fois votre compte validé.",
        });

        // Auto-connexion
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: ownerEmail,
          password: password,
        });

        if (signInError) {
          navigate('/auth');
        } else {
          navigate('/pharmacy-dashboard');
        }
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'inscription",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4 pb-24">
      <div className="w-full max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary mb-2">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Inscription Pharmacie
          </h1>
          <p className="text-muted-foreground">Rejoignez le réseau Arthur</p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle>Informations de la pharmacie</CardTitle>
            <CardDescription>
              Remplissez le formulaire pour créer votre compte pharmacien
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Informations pharmacie */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Établissement</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="pharmacy-name">Nom de la pharmacie *</Label>
                  <Input
                    id="pharmacy-name"
                    type="text"
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    required
                    placeholder="Pharmacie du Centre"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse *</Label>
                  <Input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    placeholder="123 rue de la République"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postal-code">Code postal *</Label>
                    <Input
                      id="postal-code"
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      required
                      placeholder="75001"
                      maxLength={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Ville *</Label>
                    <Input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      placeholder="Paris"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01 23 45 67 89"
                  />
                </div>
              </div>

              {/* Informations propriétaire */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Compte administrateur</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="owner-name">Nom complet *</Label>
                  <Input
                    id="owner-name"
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required
                    placeholder="Jean Dupont"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-email">Email professionnel *</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    required
                    placeholder="jean.dupont@pharmacie.fr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Min. 8 caractères"
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmer le mot de passe *</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Répétez le mot de passe"
                    minLength={8}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? 'Envoi en cours...' : 'Envoyer la demande'}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                En vous inscrivant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => navigate('/auth')}
            className="text-sm"
          >
            Déjà inscrit ? Se connecter
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PharmacyRegister;
