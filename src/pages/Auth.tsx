import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, QrCode, Download, Camera } from "lucide-react";
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [qrCodeNumber, setQrCodeNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQrResult, setShowQrResult] = useState(false);
  const [generatedQrCode, setGeneratedQrCode] = useState('');
  const [generatedQrNumber, setGeneratedQrNumber] = useState('');
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);

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
    setLoading(true);

    try {
      const randomPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
      const userEmail = email.trim() || `qrcode-${crypto.randomUUID()}@app.local`;

      const { data, error } = await supabase.auth.signUp({
        email: userEmail,
        password: randomPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('qr_code_number')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          const qrDataUrl = await QRCode.toDataURL(profile.qr_code_number);
          setGeneratedQrCode(qrDataUrl);
          setGeneratedQrNumber(profile.qr_code_number);
          setShowQrResult(true);

          await supabase.auth.signOut();
        }
      }

      toast({
        title: "QR Code créé",
        description: "Scannez ou notez votre numéro pour vous connecter",
      });
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
    setLoading(true);

    try {
      // Call edge function to get email for QR code
      const { data, error } = await supabase.functions.invoke('qr-code-login', {
        body: { qrCodeNumber: qrCodeNumber.trim() }
      });

      if (error) throw error;
      if (!data?.email) throw new Error("Numéro de QR code invalide");

      // Sign in with the email and QR code number as password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: qrCodeNumber.trim(),
      });

      if (signInError) throw signInError;

      navigate('/');
    } catch (error: any) {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Numéro de QR code invalide",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startScanning = async () => {
    setScanning(true);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setQrCodeNumber(decodedText);
          stopScanning();
          toast({
            title: "QR Code scanné",
            description: "Numéro détecté avec succès",
          });
        },
        () => {}
      );
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible d'accéder à la caméra",
        variant: "destructive",
      });
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const downloadQrCode = () => {
    const link = document.createElement('a');
    link.href = generatedQrCode;
    link.download = `qrcode-${generatedQrNumber}.png`;
    link.click();
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

        {showQrResult ? (
          <Card className="border-2 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Votre QR Code
              </CardTitle>
              <CardDescription>Conservez précieusement ces informations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <img src={generatedQrCode} alt="QR Code" className="w-64 h-64 border-2 rounded-lg" />
                
                <div className="w-full space-y-2">
                  <Label>Numéro de QR Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={generatedQrNumber}
                      readOnly
                      className="text-center font-mono text-lg font-bold border-2"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Utilisez ce numéro pour vous connecter
                  </p>
                </div>

                <div className="w-full space-y-2">
                  <Button
                    onClick={downloadQrCode}
                    className="w-full"
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger le QR Code
                  </Button>
                  
                  <Button
                    onClick={() => {
                      setShowQrResult(false);
                      setEmail('');
                      setGeneratedQrCode('');
                      setGeneratedQrNumber('');
                    }}
                    className="w-full bg-gradient-primary hover:opacity-90"
                  >
                    Se connecter maintenant
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 shadow-lg">
            <CardHeader>
              <CardTitle>Bienvenue</CardTitle>
              <CardDescription>Connectez-vous pour commencer</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Connexion</TabsTrigger>
                  <TabsTrigger value="signup">Inscription</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    {!scanning ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="qr-code-number">Numéro de QR Code</Label>
                          <Input
                            id="qr-code-number"
                            type="text"
                            placeholder="12345678"
                            value={qrCodeNumber}
                            onChange={(e) => setQrCodeNumber(e.target.value)}
                            required
                            className="border-2 font-mono"
                            maxLength={8}
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={startScanning}
                            variant="outline"
                            className="flex-1"
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Scanner QR Code
                          </Button>
                          
                          <Button
                            type="submit"
                            className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
                            disabled={loading}
                          >
                            {loading ? 'Connexion...' : 'Se connecter'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div id="qr-reader" className="border-2 rounded-lg overflow-hidden"></div>
                        <Button
                          type="button"
                          onClick={stopScanning}
                          variant="outline"
                          className="w-full"
                        >
                          Annuler le scan
                        </Button>
                      </div>
                    )}
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email (optionnel)</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="votre@email.fr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="border-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        L'email permet de récupérer votre QR code en cas de perte
                      </p>
                    </div>
                    
                    <Button
                      type="submit"
                      className="w-full bg-gradient-secondary hover:opacity-90 transition-opacity"
                      disabled={loading}
                    >
                      {loading ? 'Création...' : 'Créer mon QR Code'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Auth;
