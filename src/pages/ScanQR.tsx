import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, MapPin, Phone, Mail, Camera, X, Image as ImageIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Html5Qrcode } from "html5-qrcode";

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
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!qrCode) return;
    // Si un code est fourni via l'URL (QR externe), on redirige vers l'inscription
    navigate(`/auth?code=${encodeURIComponent(qrCode)}`);
  }, [qrCode, navigate]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Après détection d'une pharmacie depuis un lien QR (paramètre code),
  // déclenche l'affiliation automatique pour les nouveaux utilisateurs
  useEffect(() => {
    if (!qrCode || !pharmacy) return;

    handleAffiliation('temporary');
  }, [qrCode, pharmacy]);

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

  const startScanning = async () => {
    setScanning(true);
    try {
      // In iframe, some browsers block camera prompts
      if (window.top !== window.self) {
        console.warn('Running inside an iframe; camera permissions may be limited.');
      }
      // Preflight permission to trigger prompt early
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } } });
      } catch {
        await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          stopScanning();
          setManualCode(decodedText);
          findPharmacy(decodedText);
        },
        undefined
      );
    } catch (err) {
      console.error('Error starting scanner:', err);
      toast({
        title: "Accès caméra refusé",
        description: "Ouvrez dans un nouvel onglet, installez l'app (/install) ou importez une photo du QR code.",
        variant: "destructive",
      });
      setScanning(false);
    }
  };

  const selectPhoto = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const tempId = 'qr-temp-reader';
      let tempEl = document.getElementById(tempId);
      if (!tempEl) {
        tempEl = document.createElement('div');
        tempEl.id = tempId;
        tempEl.style.display = 'none';
        document.body.appendChild(tempEl);
      }
      const html5QrCode = new Html5Qrcode(tempId);
      const result = await html5QrCode.scanFile(file, true);
      setManualCode(result);
      await findPharmacy(result);
    } catch (err) {
      console.error('Image scan failed:', err);
      toast({
        title: "Échec du scan de l'image",
        description: "Assurez-vous que le QR code est net et bien cadré.",
        variant: "destructive",
      });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        setScanning(false);
      }).catch(console.error);
    } else {
      setScanning(false);
    }
  };

  const handleAffiliation = async (autoAffiliationType?: 'temporary' | 'permanent') => {
    if (!pharmacy) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Si pas connecté, sauvegarder l'info et rediriger vers auth
      localStorage.setItem('pending_pharmacy_affiliation', JSON.stringify({
        pharmacy_id: pharmacy.id,
        affiliation_type: autoAffiliationType || affiliationType
      }));
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      const finalAffiliationType = autoAffiliationType || affiliationType;
      
      // Supprimer toutes les affiliations existantes de l'utilisateur
      const { error: deleteError } = await (supabase as any)
        .from('user_pharmacy_affiliation')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Créer la nouvelle affiliation
      const { error } = await (supabase as any)
        .from('user_pharmacy_affiliation')
        .insert({
          user_id: user.id,
          pharmacy_id: pharmacy.id,
          affiliation_type: finalAffiliationType
        });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Affiliation réussie",
        description: `${pharmacy.name} est maintenant votre pharmacie référente ${finalAffiliationType === 'temporary' ? 'temporaire' : 'définitive'}`,
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
              <CardTitle>Scannez ou entrez le code QR de votre pharmacie</CardTitle>
              <CardDescription>
                Utilisez la caméra pour scanner le QR code ou entrez-le manuellement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!scanning ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={startScanning}
                      className="w-full bg-gradient-primary"
                    >
                      <Camera className="h-5 w-5 mr-2" />
                      Scanner avec la caméra
                    </Button>

                    <Button
                      type="button"
                      onClick={selectPhoto}
                      variant="outline"
                      className="w-full"
                    >
                      <ImageIcon className="h-5 w-5 mr-2" />
                      Importer une photo
                    </Button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Ou</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="qr-code">Entrer le code manuellement</Label>
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
                      variant="outline"
                      className="w-full"
                    >
                      {loading ? 'Recherche...' : 'Valider'}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="space-y-4">
                  <div id="qr-reader" ref={scannerContainerRef} className="w-full rounded-lg overflow-hidden" />
                  <Button
                    type="button"
                    onClick={stopScanning}
                    variant="outline"
                    className="w-full"
                  >
                    <X className="h-5 w-5 mr-2" />
                    Annuler le scan
                  </Button>
                </div>
              )}
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
                  onClick={() => handleAffiliation()}
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