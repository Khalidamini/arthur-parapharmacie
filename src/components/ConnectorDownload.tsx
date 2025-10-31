import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle2, Copy, Monitor, Apple, Package, RefreshCw, Key } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ConnectorDownloadProps {
  pharmacyId: string;
}

export default function ConnectorDownload({ pharmacyId }: ConnectorDownloadProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
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
            Étape 1 : Télécharger le connecteur
          </CardTitle>
          <CardDescription>
            Choisissez la version pour votre système d'exploitation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-3"
              onClick={() => handleDownload('windows')}
            >
              <Monitor className="h-8 w-8" />
              <div className="text-center">
                <div className="font-semibold">Windows</div>
                <div className="text-xs text-muted-foreground">Windows 10/11</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-3"
              onClick={() => handleDownload('mac')}
            >
              <Apple className="h-8 w-8" />
              <div className="text-center">
                <div className="font-semibold">macOS</div>
                <div className="text-xs text-muted-foreground">macOS 11+</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-3"
              onClick={() => handleDownload('linux')}
            >
              <Package className="h-8 w-8" />
              <div className="text-center">
                <div className="font-semibold">Linux</div>
                <div className="text-xs text-muted-foreground">Ubuntu/Debian</div>
              </div>
            </Button>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold">📦 Installation</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Double-cliquez sur le fichier téléchargé</li>
              <li>• Suivez l'assistant d'installation</li>
              <li>• Le connecteur se lancera automatiquement</li>
            </ul>
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
