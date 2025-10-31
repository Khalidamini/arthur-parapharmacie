import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle2, Copy, Monitor, Apple, Settings, Key, Info, Loader2, Upload } from "lucide-react";
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
  const [uploading, setUploading] = useState(false);
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
    windows: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-windows.ps1?download=install-windows.ps1',
    mac: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-mac.sh?download=install-mac.sh',
    linux: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-linux.sh?download=install-linux.sh'
  };

  const uploadInstallers = async (silent = false) => {
    try {
      setUploading(true);
      if (!silent) {
        toast({
          title: "Préparation des installateurs",
          description: "Upload des scripts en cours...",
        });
      }

      const { error } = await supabase.functions.invoke('upload-installer-scripts');
      
      if (error) throw error;

      if (!silent) {
        toast({
          title: "Installateurs prêts",
          description: "Les scripts d'installation sont maintenant disponibles.",
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (!silent) {
        toast({
          title: "Erreur",
          description: "Impossible d'uploader les installateurs. Réessayez plus tard.",
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    // Upload automatique et idempotent des scripts (macOS/Linux)
    uploadInstallers(true).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = async (platform: 'windows' | 'mac' | 'linux') => {
    const url = downloadLinks[platform];

    try {
      // Téléchargement binaire pour éviter l'ouverture en texte dans le navigateur
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error('download_failed');
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      const fallbackName = platform === 'windows' ? 'install-windows.ps1' : platform === 'mac' ? 'install-mac.sh' : 'install-linux.sh';
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      const msg = {
        windows: "Installation téléchargée ! Faites un clic droit sur 'install-windows.ps1' → Exécuter avec PowerShell.",
        mac: "Le script a été téléchargé. Dans le Terminal : cd ~/Downloads && chmod +x install-mac.sh && ./install-mac.sh",
        linux: "Le script a été téléchargé. Dans le Terminal : cd ~/Downloads && chmod +x install-linux.sh && ./install-linux.sh",
      };

      toast({ title: 'Téléchargement réussi', description: msg[platform], duration: 10000 });
    } catch (e) {
      toast({
        title: 'Erreur de téléchargement',
        description: "Impossible de récupérer l'installateur. Merci de réessayer.",
        variant: 'destructive',
      });
    }
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

          {/* Instructions détaillées par plateforme */}
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 space-y-3 text-sm">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">📝 Après le téléchargement :</h4>
            
            <div className="space-y-3">
              <div className="bg-white dark:bg-gray-900 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-blue-900 dark:text-blue-100">Windows</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
                  <li>Trouvez le fichier <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">install-windows.ps1</code> dans vos Téléchargements</li>
                  <li><strong>Clic droit</strong> sur le fichier → <strong>"Exécuter avec PowerShell"</strong></li>
                  <li>Attendez la fin de l'installation (2-3 minutes)</li>
                  <li>C'est fini ! Le connecteur démarre automatiquement</li>
                </ol>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Apple className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-blue-900 dark:text-blue-100">macOS</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
                  <li>Ouvrez <strong>Terminal</strong> (Cmd+Espace → tapez "terminal")</li>
                  <li>Copiez-collez cette commande :</li>
                </ol>
                <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded mt-2 text-xs font-mono overflow-x-auto">
                  cd ~/Downloads && chmod +x install-mac.sh && ./install-mac.sh
                </code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  ⚠️ Si demandé, entrez votre mot de passe Mac (normal, c'est pour l'installation)
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🐧</span>
                  <span className="font-semibold text-blue-900 dark:text-blue-100">Linux</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
                  <li>Ouvrez votre <strong>Terminal</strong></li>
                  <li>Copiez-collez cette commande :</li>
                </ol>
                <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded mt-2 text-xs font-mono overflow-x-auto">
                  cd ~/Downloads && chmod +x install-linux.sh && ./install-linux.sh
                </code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  ⚠️ Si demandé, entrez votre mot de passe sudo (normal, pour installer Python si besoin)
                </p>
              </div>
            </div>
          </div>
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
