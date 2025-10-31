import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle2, Copy, Monitor, Apple, Package, RefreshCw, Key, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConnectorDownloadProps {
  pharmacyId: string;
}

export default function ConnectorDownload({ pharmacyId }: ConnectorDownloadProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadApiKey();
    checkFileAvailability();

    // Re-vérifie après 2s pour contourner le cache
    const t = setTimeout(checkFileAvailability, 2000);
    return () => clearTimeout(t);
  }, [pharmacyId]);

  const checkFileAvailability = async () => {
    try {
      const url = 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.py?cb=' + Date.now();
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      setFileReady(response.ok);
    } catch (error) {
      console.error('Error checking file:', error);
      setFileReady(false);
    }
  };

  const handleUploadConnector = async () => {
    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('upload-connector-files');
      if (error) throw error;

      // Vérifier la disponibilité publique avec retries (propagation CDN)
      const publicUrl = 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.py';
      let available = false;
      for (let i = 0; i < 5; i++) {
        const resp = await fetch(`${publicUrl}?cb=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
        if (resp.ok) { available = true; break; }
        await new Promise(r => setTimeout(r, 800));
      }

      setFileReady(available);
      toast({
        title: available ? '✓ Connecteur prêt' : 'Connecteur en préparation',
        description: available
          ? 'Le fichier Python est disponible au téléchargement.'
          : "Le fichier a été créé mais la mise à jour peut prendre quelques secondes. Réessayez d'ici peu.",
      });

      if (!available) {
        // Lancer une vérification différée
        setTimeout(checkFileAvailability, 1500);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'uploader le connecteur. Vérifiez vos permissions.",
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

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
    mac: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.dmg',
    linux: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.AppImage'
  };

  const handleDownload = async (platform: 'windows' | 'mac' | 'linux') => {
    try {
      const url = downloadLinks[platform];
      
      // Vérifier si le fichier existe
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        toast({
          title: "Connecteur en préparation",
          description: "Les fichiers d'installation seront bientôt disponibles. Contactez le support pour plus d'informations.",
        });
        return;
      }
      
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: "Téléchargement indisponible",
        description: "Le connecteur est en cours de préparation. Contactez le support Arthur.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Étape 1 : Téléchargement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Télécharger le connecteur Arthur
          </CardTitle>
          <CardDescription>
            Solution professionnelle simple et universelle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!fileReady && (
            <Alert>
              <Upload className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm">Préparez d'abord le fichier de téléchargement</span>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleUploadConnector} 
                      disabled={uploading}
                      size="sm"
                      variant="outline"
                    >
                      {uploading ? "Préparation..." : "Préparer le connecteur"}
                    </Button>
                    <Button
                      onClick={checkFileAvailability}
                      size="sm"
                      variant="ghost"
                    >
                      Rafraîchir
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="border-2 border-primary rounded-lg p-6 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-primary rounded-lg">
                <Package className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Installateurs Standalone</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Aucune installation Python requise - Fonctionne directement
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Pas besoin de Python</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Pharmagest, LGPI, Winpharma</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Double-clic pour lancer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Sync auto toutes les 15 min</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDownload('windows')}
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    Windows (.exe)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDownload('mac')}
                  >
                    <Apple className="mr-2 h-4 w-4" />
                    macOS (.dmg)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDownload('linux')}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Linux (.AppImage)
                  </Button>
                </div>

                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-900 dark:text-blue-100">
                  <strong>Version Python disponible:</strong> Si vous préférez utiliser Python directement,{' '}
                  <button
                    className="text-primary underline hover:no-underline"
                    onClick={() => {
                      const url = 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.py?download=arthur-connector.py&cb=' + Date.now();
                      window.open(url, '_blank', 'noopener');
                    }}
                  >
                    téléchargez le script Python
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-4 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-semibold">Télécharger pour votre système</p>
                <p className="text-muted-foreground">Choisissez Windows (.exe), macOS (.dmg) ou Linux (.AppImage)</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-semibold">Lancer l'installateur</p>
                <p className="text-muted-foreground">Double-clic sur le fichier téléchargé</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-semibold">Configuration automatique</p>
                <p className="text-muted-foreground">Suivez l'assistant et entrez les informations ci-dessous</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <p className="font-semibold text-blue-900 mb-2">💡 Aucune connaissance technique requise</p>
            <p className="text-blue-800">
              Le connecteur détecte automatiquement votre logiciel de pharmacie
              et synchronise vos produits en temps réel.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Étape 2 : Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Étape 2 : Informations de configuration
          </CardTitle>
          <CardDescription>
            Ces informations sont nécessaires pour configurer le connecteur
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ID Pharmacie */}
          <div className="space-y-2">
            <Label>ID de votre pharmacie</Label>
            <div className="flex gap-2">
              <Input
                value={pharmacyId}
                readOnly
                className="font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(pharmacyId, "ID pharmacie")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Clé API */}
          <div className="space-y-2">
            <Label>Clé API</Label>
            {apiKey ? (
              <div className="flex gap-2">
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
              </div>
            ) : (
              <Button
                onClick={generateApiKey}
                disabled={generating || loading}
                className="w-full"
              >
                {generating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Générer une clé API
                  </>
                )}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              ⚠️ Gardez cette clé secrète. Ne la partagez jamais.
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold">⚙️ Configuration du connecteur</p>
            <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
              <li>Clic droit sur l'icône Arthur (barre des tâches)</li>
              <li>Choisir "Configurer"</li>
              <li>Copier-coller l'ID pharmacie et la clé API</li>
              <li>Valider</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Étape 3 : Utilisation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Étape 3 : C'est terminé !
          </CardTitle>
          <CardDescription>
            Le connecteur synchronise automatiquement vos produits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-green-900">✅ Synchronisation automatique activée</p>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Synchronisation toutes les 15 minutes</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Détection automatique de votre logiciel de pharmacie</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Mise à jour automatique des prix et stocks</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Notifications en cas d'erreur</span>
              </li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold">💡 Actions disponibles</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>Synchroniser maintenant</strong> : Clic droit → Synchroniser</li>
              <li>• <strong>Voir les logs</strong> : Clic droit → Logs</li>
              <li>• <strong>Statut</strong> : L'icône change de couleur selon l'état</li>
            </ul>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
            <RefreshCw className="h-4 w-4 flex-shrink-0" />
            <span>Le connecteur tourne en arrière-plan. Vous n'avez plus rien à faire !</span>
          </div>
        </CardContent>
      </Card>

      {/* Support */}
      <Card>
        <CardHeader>
          <CardTitle>Besoin d'aide ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Le connecteur ne détecte pas votre logiciel ? Une erreur de synchronisation ?
          </p>
          <Button variant="outline" className="w-full">
            Contacter le support Arthur
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
