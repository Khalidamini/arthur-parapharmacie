import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Check, Smartphone, MessageSquare } from "lucide-react";
import Footer from '@/components/Footer';

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
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
          <p className="text-muted-foreground">Installer l'application</p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isInstalled ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  Application installée
                </>
              ) : (
                <>
                  <Smartphone className="h-5 w-5" />
                  Installer sur votre téléphone
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isInstalled 
                ? "L'application est déjà installée sur votre appareil"
                : "Installez Arthur sur votre écran d'accueil pour un accès rapide"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isInstalled && (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary font-semibold text-xs">1</span>
                    </div>
                    <p>Appuyez sur le bouton "Installer" ci-dessous</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary font-semibold text-xs">2</span>
                    </div>
                    <p>Suivez les instructions de votre navigateur</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary font-semibold text-xs">3</span>
                    </div>
                    <p>L'icône Arthur apparaîtra sur votre écran d'accueil</p>
                  </div>
                </div>

                {deferredPrompt ? (
                  <Button
                    onClick={handleInstall}
                    className="w-full bg-gradient-primary hover:opacity-90"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Installer l'application
                  </Button>
                ) : (
                  <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                    <p className="font-semibold">Installation manuelle :</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>iPhone :</strong> Appuyez sur Partager → Ajouter à l'écran d'accueil</li>
                      <li><strong>Android :</strong> Menu du navigateur → Installer l'application</li>
                    </ul>
                  </div>
                )}
              </>
            )}

            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full"
            >
              {isInstalled ? "Retour à l'accueil" : "Continuer sans installer"}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>✨ Profitez d'une expérience optimale avec l'application installée</p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Install;
