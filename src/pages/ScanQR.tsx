import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, MapPin, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  qr_code: string;
}

const ScanQR = () => {
  const [searchParams] = useSearchParams();
  const qrCode = searchParams.get('code');
  const [manualCode, setManualCode] = useState(qrCode || '');
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [affiliationType, setAffiliationType] = useState<'temporary' | 'permanent'>('temporary');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (qrCode) {
      findPharmacy(qrCode);
    }
  }, [qrCode]);

  const findPharmacy = async (code: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('pharmacies')
        .select('*')
        .eq('qr_code', code)
        .single();

      if (error) throw error;

      if (data) {
        setPharmacy(data as Pharmacy);
      } else {
        toast({
          title: "QR Code invalide",
          description: "Aucune pharmacie trouvée avec ce code",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error finding pharmacy:', error);
      toast({
        title: "Erreur",
        description: "Impossible de trouver la pharmacie",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode) {
      await findPharmacy(manualCode);
    }
  };

  const handleAffiliation = async () => {
    if (!pharmacy) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      // Vérifier si l'utilisateur a déjà une affiliation
      const { data: existingAffiliation } = await (supabase as any)
        .from('user_pharmacy_affiliation')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingAffiliation) {
        // Mettre à jour l'affiliation existante
        const { error } = await (supabase as any)
          .from('user_pharmacy_affiliation')
          .update({
            pharmacy_id: pharmacy.id,
            is_permanent: affiliationType === 'permanent',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Créer une nouvelle affiliation
        const { error } = await (supabase as any)
          .from('user_pharmacy_affiliation')
          .insert({
            user_id: user.id,
            pharmacy_id: pharmacy.id,
            is_permanent: affiliationType === 'permanent'
          });

        if (error) throw error;
      }

      setSuccess(true);
      toast({
        title: "Affiliation réussie",
        description: `${pharmacy.name} est maintenant votre pharmacie référente ${affiliationType === 'temporary' ? 'temporaire' : 'définitive'}`,
      });

      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Error creating affiliation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer l'affiliation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Scanner un QR Code</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {!pharmacy ? (
          <Card>
            <CardHeader>
              <CardTitle>Entrez le code QR de votre pharmacie</CardTitle>
              <CardDescription>
                Scannez le QR code fourni par votre pharmacie ou entrez-le manuellement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qr-code">Code QR</Label>
                  <Input
                    id="qr-code"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Entrez le code QR"
                    disabled={loading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!manualCode || loading}
                  className="w-full bg-gradient-primary"
                >
                  {loading ? 'Recherche...' : 'Valider'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : success ? (
          <Card className="border-2 border-primary">
            <CardContent className="pt-6 text-center">
              <div className="h-16 w-16 rounded-full bg-primary mx-auto mb-4 flex items-center justify-center">
                <Check className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Affiliation réussie !
              </h2>
              <p className="text-muted-foreground">
                Vous allez être redirigé...
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Pharmacie trouvée</CardTitle>
              <CardDescription>
                Confirmez votre affiliation à cette pharmacie
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">{pharmacy.name}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p>{pharmacy.address}</p>
                      <p>{pharmacy.postal_code} {pharmacy.city}</p>
                    </div>
                  </div>
                  {pharmacy.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <p>{pharmacy.phone}</p>
                    </div>
                  )}
                  {pharmacy.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <p>{pharmacy.email}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Type d'affiliation</Label>
                <RadioGroup
                  value={affiliationType}
                  onValueChange={(value) => setAffiliationType(value as 'temporary' | 'permanent')}
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="temporary" id="temporary" />
                    <Label htmlFor="temporary" className="cursor-pointer flex-1">
                      <div>
                        <p className="font-medium">Temporaire</p>
                        <p className="text-sm text-muted-foreground">
                          Cette pharmacie sera votre référente pour cette session
                        </p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="permanent" id="permanent" />
                    <Label htmlFor="permanent" className="cursor-pointer flex-1">
                      <div>
                        <p className="font-medium">Définitive</p>
                        <p className="text-sm text-muted-foreground">
                          Cette pharmacie restera votre référente par défaut
                        </p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPharmacy(null)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleAffiliation}
                  disabled={loading}
                  className="flex-1 bg-gradient-primary"
                >
                  {loading ? 'Affiliation...' : 'Confirmer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ScanQR;