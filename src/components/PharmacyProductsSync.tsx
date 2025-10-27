import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PharmacyProductsSyncProps {
  pharmacyId: string;
}

interface SyncResult {
  success: boolean;
  results?: {
    created: number;
    updated: number;
    errors: string[];
  };
  error?: string;
}

export default function PharmacyProductsSync({ pharmacyId }: PharmacyProductsSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [jsonData, setJsonData] = useState('');
  const { toast } = useToast();

  const exampleFormat = `[
  {
    "name": "Doliprane 1000mg",
    "brand": "Sanofi",
    "price": 3.50,
    "category": "Antidouleur",
    "description": "Paracétamol 1000mg",
    "image_url": "https://...",
    "stock_quantity": 100,
    "is_available": true
  }
]`;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setJsonData(JSON.stringify(data, null, 2));
      
      toast({
        title: "Fichier chargé",
        description: `${Array.isArray(data) ? data.length : 0} produits détectés`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Format de fichier invalide. Utilisez un fichier JSON valide.",
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);

      let products;
      try {
        products = JSON.parse(jsonData);
      } catch {
        throw new Error("Format JSON invalide");
      }

      if (!Array.isArray(products)) {
        throw new Error("Le JSON doit contenir un tableau de produits");
      }

      const { data, error } = await supabase.functions.invoke('sync-pharmacy-products', {
        body: {
          pharmacy_id: pharmacyId,
          products,
        },
      });

      if (error) throw error;

      setSyncResult(data);
      
      toast({
        title: "Synchronisation réussie",
        description: `${data.results.created} créés, ${data.results.updated} mis à jour`,
      });
    } catch (error) {
      console.error('Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la synchronisation';
      setSyncResult({
        success: false,
        error: errorMessage,
      });
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Synchronisation du catalogue
          </CardTitle>
          <CardDescription>
            Importez ou mettez à jour vos produits depuis votre système de gestion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="json" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="json">Import JSON</TabsTrigger>
              <TabsTrigger value="file">Fichier JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="json-data">Données JSON</Label>
                <Textarea
                  id="json-data"
                  value={jsonData}
                  onChange={(e) => setJsonData(e.target.value)}
                  placeholder={exampleFormat}
                  className="font-mono text-sm min-h-[300px]"
                />
                <p className="text-xs text-muted-foreground">
                  Collez vos données au format JSON ci-dessus
                </p>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer text-primary hover:underline"
                  >
                    Cliquez pour sélectionner un fichier JSON
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Format accepté : .json
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex gap-3">
            <Button
              onClick={handleSync}
              disabled={syncing || !jsonData}
              className="flex-1"
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Synchronisation en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Synchroniser
                </>
              )}
            </Button>
          </div>

          {syncResult && (
            <div className={`mt-4 p-4 rounded-lg ${syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {syncResult.success ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-800 font-semibold">
                    <CheckCircle2 className="h-5 w-5" />
                    Synchronisation réussie
                  </div>
                  <div className="text-sm text-green-700">
                    <p>✓ {syncResult.results?.created || 0} produits créés</p>
                    <p>✓ {syncResult.results?.updated || 0} produits mis à jour</p>
                    {syncResult.results?.errors && syncResult.results.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold">Erreurs :</p>
                        <ul className="list-disc list-inside">
                          {syncResult.results.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-red-800">
                  <p className="font-semibold">Erreur de synchronisation</p>
                  <p className="text-sm mt-1">{syncResult.error}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Format des données
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Structure requise :</h4>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
              {exampleFormat}
            </pre>
          </div>
          <div className="space-y-2 text-sm">
            <h4 className="font-semibold">Champs requis :</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><code className="bg-muted px-1 rounded">name</code> : Nom du produit</li>
              <li><code className="bg-muted px-1 rounded">brand</code> : Marque</li>
              <li><code className="bg-muted px-1 rounded">price</code> : Prix (nombre décimal)</li>
              <li><code className="bg-muted px-1 rounded">category</code> : Catégorie</li>
              <li><code className="bg-muted px-1 rounded">stock_quantity</code> : Quantité en stock</li>
              <li><code className="bg-muted px-1 rounded">is_available</code> : Disponibilité (true/false)</li>
            </ul>
            <h4 className="font-semibold mt-4">Champs optionnels :</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><code className="bg-muted px-1 rounded">description</code> : Description du produit</li>
              <li><code className="bg-muted px-1 rounded">image_url</code> : URL de l'image</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
