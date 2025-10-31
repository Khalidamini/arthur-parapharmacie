import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle2, Copy, Monitor, Apple, Settings, Key, Info, Loader2, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import JSZip from "jszip";
interface ConnectorDownloadProps {
  pharmacyId: string;
}
export default function ConnectorDownload({
  pharmacyId
}: ConnectorDownloadProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadApiKey();
  }, [pharmacyId]);
  const loadApiKey = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('pharmacy_api_keys').select('api_key').eq('pharmacy_id', pharmacyId).maybeSingle();
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
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-pharmacy-api-key', {
        body: {
          pharmacy_id: pharmacyId
        }
      });
      if (error) throw error;
      setApiKey(data.api_key);
      toast({
        title: "Clé API générée",
        description: "Utilisez cette clé pour configurer le connecteur"
      });
    } catch (error) {
      console.error('Error generating API key:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer la clé API",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié !",
      description: `${label} copié dans le presse-papiers`
    });
  };
  const downloadLinks = {
    windows: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-windows.ps1?download=install-windows.ps1',
    mac: 'zip-local',
    linux: 'https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-linux.sh?download=install-linux.sh'
  };

  // URL des fonctions backend (pour préremplir la config GUI)
  const FUNCTIONS_URL = (import.meta as any).env.VITE_SUPABASE_URL + '/functions/v1';

  // Fichier Python minimal pour afficher l'interface graphique et enregistrer la configuration
  const pythonGui = `#!/usr/bin/env python3
import tkinter as tk
from tkinter import ttk, messagebox
import json, pathlib, webbrowser

CONFIG_DIR = pathlib.Path.home() / '.arthur-connector'
CONFIG_FILE = CONFIG_DIR / 'config.json'

def load_config():
    try:
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {'pharmacy_id':'','api_key':'','api_url':'${FUNCTIONS_URL}','sync_interval':15}

def save_config(data):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def on_save():
    data = {
        'pharmacy_id': pharmacy_var.get().strip(),
        'api_key': api_var.get().strip(),
        'api_url': url_var.get().strip(),
        'sync_interval': 15
    }
    save_config(data)
    messagebox.showinfo('Arthur Connector', 'Configuration enregistrée.')

root = tk.Tk()
root.title('Arthur Connector')
root.geometry('520x300')

frm = ttk.Frame(root, padding=16)
frm.pack(fill='both', expand=True)

style = ttk.Style()
try:
    style.theme_use('clam')
except Exception:
    pass

pharmacy_var = tk.StringVar()
api_var = tk.StringVar()
url_var = tk.StringVar(value='${FUNCTIONS_URL}')

# Layout
labels = [('ID Pharmacie', pharmacy_var), ('Clé API', api_var), ('URL API', url_var)]
for i, (text, var) in enumerate(labels):
    ttk.Label(frm, text=text).grid(row=i, column=0, sticky='w', pady=6)
    entry = ttk.Entry(frm, textvariable=var, width=46)
    if text == 'Clé API':
        entry.configure(show='•')
    entry.grid(row=i, column=1, sticky='ew')

btns = ttk.Frame(frm)
btns.grid(row=3, column=0, columnspan=2, pady=12)

ttk.Button(btns, text='Enregistrer', command=on_save).pack(side='left', padx=6)

def open_help():
    try:
        webbrowser.open('https://arthur.pharmacy')
    except Exception:
        pass

ttk.Button(btns, text='Aide', command=open_help).pack(side='left', padx=6)

frm.columnconfigure(1, weight=1)

cfg = load_config()
pharmacy_var.set(cfg.get('pharmacy_id',''))
api_var.set(cfg.get('api_key',''))
url_var.set(cfg.get('api_url','${FUNCTIONS_URL}'))

root.mainloop()
`;

  // Script d'installation macOS (ouvre directement l'interface graphique)
  const macCommand = `#!/bin/bash
set -euo pipefail
APP_DIR="$HOME/Library/Application Support/ArthurConnector"
mkdir -p "$APP_DIR"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "→ Préparation de l'environnement..."
if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "Arthur Connector" message "Python 3 est requis. Installez les Outils de ligne de commande Xcode puis réessayez." as warning'
  exit 1
fi

if [ ! -d "$APP_DIR/venv" ]; then
  python3 -m venv "$APP_DIR/venv"
fi
source "$APP_DIR/venv/bin/activate"
python3 -m pip install --upgrade pip >/dev/null 2>&1 || true
python3 -m pip install requests schedule >/dev/null 2>&1 || true

# Copier la GUI fournie dans le zip
cp -f "$SCRIPT_DIR/arthur-connector-gui.py" "$APP_DIR/arthur-connector-gui.py"

# Lancer la GUI
echo "→ Lancement de l'interface graphique..."
python3 "$APP_DIR/arthur-connector-gui.py"
`;

  const createMacZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder('ArthurConnector');
    if (!folder) return;
    folder.file('arthur-connector-gui.py', pythonGui);
    folder.file('install-mac.command', macCommand, { unixPermissions: '755' });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ArthurConnector-mac.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const uploadInstallers = async (silent = false) => {
    try {
      setUploading(true);
      if (!silent) {
        toast({
          title: "Préparation des installateurs",
          description: "Upload des scripts en cours..."
        });
      }
      const {
        error
      } = await supabase.functions.invoke('upload-installer-scripts');
      if (error) throw error;
      if (!silent) {
        toast({
          title: "Installateurs prêts",
          description: "Les scripts d'installation sont maintenant disponibles."
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (!silent) {
        toast({
          title: "Erreur",
          description: "Impossible d'uploader les installateurs. Réessayez plus tard.",
          variant: "destructive"
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
    try {
      if (platform === 'mac') {
        await createMacZip();
        toast({
          title: 'Téléchargement réussi',
          description: "Ouvrez 'ArthurConnector-mac.zip', puis double-cliquez sur 'install-mac.command'. L'interface s'ouvrira.",
          duration: 12000,
        });
        return;
      }

      const url = downloadLinks[platform];
      // S'assure que les scripts sont bien disponibles (idempotent)
      await uploadInstallers(true);
      // Téléchargement binaire pour éviter l'ouverture en texte dans le navigateur
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error('download_failed');
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const fallbackName = platform === 'windows' ? 'install-windows.ps1' : 'install-linux.sh';
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      const msg = {
        windows: "Fichier téléchargé ! Clic droit sur 'install-windows.ps1' → Exécuter avec PowerShell.",
        linux: "Fichier téléchargé ! Clic droit sur 'install-linux.sh' → Exécuter dans un terminal.",
      } as const;
      toast({ title: 'Téléchargement réussi', description: msg[platform], duration: 10000 });
    } catch (e) {
      toast({
        title: 'Erreur de téléchargement',
        description: "Impossible de récupérer l'installateur. Merci de réessayer.",
        variant: 'destructive',
      });
    }
  };
  return <div className="space-y-6">
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
            <Button onClick={() => handleDownload('windows')} className="h-auto py-6 flex flex-col gap-2" size="lg">
              <Monitor className="h-10 w-10" />
              <span className="font-semibold text-lg">Windows</span>
              <span className="text-xs opacity-90">Installation automatique</span>
            </Button>
            
            <Button onClick={() => handleDownload('mac')} className="h-auto py-6 flex flex-col gap-2" size="lg">
              <Apple className="h-10 w-10" />
              <span className="font-semibold text-lg">macOS</span>
              <span className="text-xs opacity-90">Installation automatique</span>
            </Button>
            
            <Button onClick={() => handleDownload('linux')} className="h-auto py-6 flex flex-col gap-2" size="lg">
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
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  ⚠️ Si Windows bloque l'exécution : cliquez sur "Plus d'infos" puis "Exécuter quand même"
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Apple className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-blue-900 dark:text-blue-100">macOS</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
                  <li>Ouvrez <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ArthurConnector-mac.zip</code> puis double-cliquez sur <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">install-mac.command</code></li>
                  <li>L'interface graphique s'ouvre immédiatement</li>
                </ol>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  ⚠️ Si macOS bloque: Préférences Système → Confidentialité et sécurité → Autoriser quand même
                  ou exécutez la commande ci-dessous dans Terminal puis relancez le fichier:
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs overflow-x-auto">xattr -dr com.apple.quarantine ~/Downloads/ArthurConnector/install-mac.command && open ~/Downloads/ArthurConnector/install-mac.command</code>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard('xattr -dr com.apple.quarantine ~/Downloads/ArthurConnector/install-mac.command && open ~/Downloads/ArthurConnector/install-mac.command', 'Commande macOS')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🐧</span>
                  <span className="font-semibold text-blue-900 dark:text-blue-100">Linux</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
                  <li>Trouvez le fichier <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">install-linux.sh</code> dans vos Téléchargements</li>
                  <li><strong>Clic droit</strong> → <strong>"Exécuter"</strong> ou <strong>"Exécuter dans un terminal"</strong></li>
                  <li>Attendez la fin de l'installation (2-3 minutes)</li>
                  <li>C'est fini ! Le connecteur démarre automatiquement</li>
                </ol>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  ⚠️ Si demandé, entrez votre mot de passe (normal, pour installer Python si besoin)
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
              <Input value={pharmacyId} readOnly className="font-mono" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(pharmacyId, "ID")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-muted-foreground">Clé API</Label>
            <div className="flex gap-2 mt-1">
              {apiKey ? <>
                  <Input value={apiKey} readOnly type="password" className="font-mono" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiKey, "Clé API")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </> : <Button onClick={generateApiKey} disabled={generating} className="w-full">
                  {generating ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Génération...
                    </> : <>
                      <Key className="mr-2 h-4 w-4" />
                      Générer la Clé API
                    </>}
                </Button>}
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">Ces informations vous seront demandées automatiquement au premier lancement du connecteur. Le connecteur détectera automatiquement votre logiciel de gestion.</AlertDescription>
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
              <li>Détection automatique de votre logiciel de pharmacie</li>
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
    </div>;
}