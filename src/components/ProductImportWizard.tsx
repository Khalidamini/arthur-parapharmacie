import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

interface ProductImportWizardProps {
  pharmacyId: string;
  onComplete?: () => void;
}

export default function ProductImportWizard({ pharmacyId, onComplete }: ProductImportWizardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Vérifier le format
      const validFormats = ['.csv', '.xlsx', '.xls', '.txt'];
      const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (!validFormats.includes(fileExtension)) {
        toast({
          title: "Format non supporté",
          description: "Veuillez uploader un fichier CSV, Excel ou TXT",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
      toast({
        title: "Fichier sélectionné",
        description: `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} Ko)`,
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setUploading(true);
    try {
      // Convertir le fichier en base64 pour l'envoyer à la fonction edge
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const base64Content = e.target?.result as string;
        
        const { data, error } = await supabase.functions.invoke('import-products-from-file', {
          body: {
            pharmacy_id: pharmacyId,
            file_content: base64Content.split(',')[1], // Enlever le préfixe data:
            file_name: file.name,
            file_type: file.type,
          },
        });

        if (error) throw error;

        setImportResult(data);
        
        toast({
          title: "Import réussi !",
          description: `${data.imported} produits importés avec succès`,
        });

        if (onComplete) {
          setTimeout(onComplete, 2000);
        }
      };

      reader.onerror = () => {
        throw new Error("Erreur lors de la lecture du fichier");
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erreur d'import",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = () => {
    if (onComplete) {
      onComplete();
    }
  };

  if (importResult?.success) {
    return (
      <Card className="border-2 border-green-500/20 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-green-900">Import réussi !</h3>
              <p className="text-green-700 mt-2">
                {importResult.imported} produits ont été importés dans votre catalogue
              </p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-green-600 mt-1">
                  {importResult.skipped} produits ignorés (doublons ou données manquantes)
                </p>
              )}
            </div>
            <Button onClick={handleSkip} className="mt-4">
              Continuer <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importez votre catalogue produits
          </CardTitle>
          <CardDescription>
            Exportez votre catalogue depuis votre logiciel de pharmacie et importez-le ici
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instructions simples */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm">Comment faire ?</h4>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                <span>Exportez votre catalogue produits depuis votre logiciel de pharmacie (Pharmagest, LGPI, Winpharma, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                <span>Le fichier doit être au format CSV, Excel (.xlsx, .xls) ou TXT</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                <span>Notre système détecte automatiquement les colonnes (nom, prix, stock, etc.)</span>
              </li>
            </ol>
          </div>

          {/* Zone d'upload */}
          <div className="space-y-4">
            <Label>Sélectionnez votre fichier</Label>
            <div 
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
            >
              {file ? (
                <div className="space-y-3">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} Ko
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      const input = document.getElementById('file-upload') as HTMLInputElement;
                      if (input) input.value = '';
                    }}
                  >
                    Changer de fichier
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <Label
                      htmlFor="file-upload"
                      className="cursor-pointer text-primary hover:underline font-medium"
                    >
                      Cliquez pour sélectionner un fichier
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      CSV, Excel (.xlsx, .xls) ou TXT
                    </p>
                  </div>
                </div>
              )}
              <input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={!file || uploading}
              className="flex-1"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer les produits
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={uploading}
            >
              Passer cette étape
            </Button>
          </div>

          {/* Note de compatibilité */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>✓ Compatible avec tous les logiciels de pharmacie</p>
            <p>✓ Détection automatique des colonnes</p>
            <p>✓ Vos données restent sécurisées</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
