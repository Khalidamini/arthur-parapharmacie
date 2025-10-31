import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle2, Copy, Monitor, Apple, Settings, Key, Info, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConnectorDownloadProps {
  pharmacyId: string;
}

export default function ConnectorDownload({ pharmacyId }: ConnectorDownloadProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadApiKey();
  }, [pharmacyId]);

  const loadApiKey = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pharmacy_api_keys')
        .select('api_key')
        .eq('pharmacy_id', pharmacyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setApiKey(data.api_key);
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    try {
      setGenerating(true);
      const { data, error } = await supabase.functions.invoke('generate-pharmacy-api-key', {
        body: { pharmacy_id: pharmacyId }
      });

      if (error) throw error;

      setApiKey(data.api_key);
      toast({
        title: "Clé API générée",
        description: "Utilisez cette clé pour configurer le connecteur",
      });
    } catch (error) {
      console.error('Error generating API key:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer la clé API",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié !",
      description: `${label} copié dans le presse-papiers`,
    });
  };

  const downloadLinks = {
    windows: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector-setup.exe',
    mac: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-mac.sh',
    linux: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-linux.sh'
  };

  const handleDownload = (platform: 'windows' | 'mac' | 'linux') => {
    const url = downloadLinks[platform];
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('/').pop() || 'arthur-connector-install';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const instructions = {
      windows: "Double-cliquez sur le fichier téléchargé pour lancer l'installation automatique.",
      mac: "Ouvrez un terminal, allez dans le dossier Téléchargements et exécutez : chmod +x install-mac.sh && ./install-mac.sh",
      linux: "Ouvrez un terminal, allez dans le dossier Téléchargements et exécutez : chmod +x install-linux.sh && ./install-linux.sh"
    };
    
    toast({
      title: "Téléchargement lancé",
      description: instructions[platform],
      duration: 8000,
    });
  };

  return (
    <div className="space-y-6">
      {/* Étape 1 : Téléchargement et Installation */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Étape 1 : Télécharger et Installer
          </CardTitle>
          <CardDescription>
            L'installation est entièrement automatique. Choisissez simplement votre système d'exploitation :
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => handleDownload('windows')}
              className="h-auto py-6 flex flex-col gap-2"
              size="lg"
            >
              <Monitor className="h-10 w-10" />
              <span className="font-semibold text-lg">Windows</span>
              <span className="text-xs opacity-90">Installation automatique</span>
            </Button>
            
            <Button 
              onClick={() => handleDownload('mac')}
              className="h-auto py-6 flex flex-col gap-2"
              size="lg"
            >
              <Apple className="h-10 w-10" />
              <span className="font-semibold text-lg">macOS</span>
              <span className="text-xs opacity-90">Installation automatique</span>
            </Button>
            
            <Button 
              onClick={() => handleDownload('linux')}
              className="h-auto py-6 flex flex-col gap-2"
              size="lg"
            >
              <span className="text-3xl">🐧</span>
              <span className="font-semibold text-lg">Linux</span>
              <span className="text-xs opacity-90">Installation automatique</span>
            </Button>
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>Installation entièrement automatique :</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Téléchargement des composants nécessaires</li>
                <li>Configuration de l'environnement</li>
                <li>Démarrage automatique avec Windows/macOS/Linux</li>
                <li>Aucune configuration manuelle requise</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Étape 2 : Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Étape 2 : Informations de Configuration
          </CardTitle>
          <CardDescription>
            Gardez ces informations à portée de main lors de la première utilisation :
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">ID de la Pharmacie</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={pharmacyId}
                readOnly
                className="font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(pharmacyId, "ID")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-muted-foreground">Clé API</Label>
            <div className="flex gap-2 mt-1">
              {apiKey ? (
                <>
                  <Input
                    value={apiKey}
                    readOnly
                    type="password"
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(apiKey, "Clé API")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={generateApiKey}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Générer la Clé API
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Ces informations vous seront demandées automatiquement au premier lancement du connecteur.
              Le connecteur détectera automatiquement votre logiciel de gestion (LGPI, Pharmagest, Winpharma).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Étape 3 : Terminé */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Étape 3 : C'est Terminé !
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <strong>Tout est automatique !</strong> Le connecteur Arthur fonctionne maintenant en arrière-plan.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-medium">Fonctionnement automatique :</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Détection automatique de votre logiciel (LGPI, Pharmagest, Winpharma)</li>
              <li>Synchronisation des produits et promotions toutes les 15 minutes</li>
              <li>Démarrage automatique au lancement de votre ordinateur</li>
              <li>Mises à jour automatiques du connecteur</li>
            </ul>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Le connecteur est invisible et ne nécessite aucune action de votre part.
              Vous pouvez continuer à utiliser votre logiciel normalement.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Support */}
      <Card>
        <CardHeader>
          <CardTitle>Besoin d'aide ?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notre équipe support est disponible pour vous accompagner dans l'installation et la configuration du connecteur.
          </p>
          <Button className="mt-4" variant="outline">
            Contacter le Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
