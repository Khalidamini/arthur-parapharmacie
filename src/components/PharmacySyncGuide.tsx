import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Code, Zap, FileJson, Server, Clock, Rocket } from "lucide-react";
import TurnkeySolutionContact from "./TurnkeySolutionContact";

interface PharmacySyncGuideProps {
  pharmacyId: string;
}

export default function PharmacySyncGuide({ pharmacyId }: PharmacySyncGuideProps) {
  const apiEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-pharmacy-products`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Guide de synchronisation automatique
          </CardTitle>
          <CardDescription>
            Comment connecter votre système de gestion à Arthur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="manual">
                <FileJson className="mr-2 h-4 w-4" />
                Import manuel
              </TabsTrigger>
              <TabsTrigger value="auto">
                <Zap className="mr-2 h-4 w-4" />
                Automatique
              </TabsTrigger>
              <TabsTrigger value="api">
                <Code className="mr-2 h-4 w-4" />
                API
              </TabsTrigger>
              <TabsTrigger value="turnkey">
                <Rocket className="mr-2 h-4 w-4" />
                Clé en main
              </TabsTrigger>
            </TabsList>

            {/* Import manuel */}
            <TabsContent value="manual" className="space-y-4">
              <Alert>
                <AlertDescription>
                  L'import manuel est idéal pour les premières synchronisations ou les mises à jour ponctuelles.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Étape 1 : Exporter depuis votre logiciel</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    La plupart des logiciels de gestion de pharmacie permettent d'exporter les produits en CSV ou Excel :
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Pharmagest : Menu Stocks → Export → Format CSV</li>
                    <li>LGPI : Fichier → Exporter → Catalogue produits</li>
                    <li>Winpharma : Outils → Export données → Produits</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Étape 2 : Convertir en JSON</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Utilisez un outil en ligne comme <a href="https://csvjson.com" target="_blank" className="text-primary hover:underline">csvjson.com</a> pour convertir votre CSV en JSON.
                  </p>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-xs font-mono">
                      CSV → JSON → Copier le résultat dans l'onglet "Synchronisation"
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Étape 3 : Mapper les colonnes</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Assurez-vous que vos colonnes correspondent au format requis :
                  </p>
                  <div className="bg-muted p-3 rounded-md text-xs space-y-1">
                    <p>• Nom du produit → <code className="bg-background px-1 rounded">name</code></p>
                    <p>• Marque/Laboratoire → <code className="bg-background px-1 rounded">brand</code></p>
                    <p>• Prix TTC → <code className="bg-background px-1 rounded">price</code></p>
                    <p>• Catégorie → <code className="bg-background px-1 rounded">category</code></p>
                    <p>• Stock → <code className="bg-background px-1 rounded">stock_quantity</code></p>
                    <p>• Disponible (Oui/Non) → <code className="bg-background px-1 rounded">is_available</code></p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Synchronisation automatique */}
            <TabsContent value="auto" className="space-y-4">
              <Alert>
                <AlertDescription>
                  La synchronisation automatique met à jour vos produits toutes les heures sans intervention manuelle.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Option 1 : Via votre logiciel de gestion
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Certains logiciels modernes peuvent envoyer automatiquement les données :
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Configurez un "webhook" ou "export automatique"</li>
                    <li>URL à renseigner : <code className="bg-muted px-1 rounded text-xs">{apiEndpoint}</code></li>
                    <li>Fréquence recommandée : Toutes les heures</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Option 2 : Tâche planifiée (Windows Task Scheduler)
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Créez un script qui exporte et envoie automatiquement vos données :
                  </p>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-xs font-mono mb-2">Script PowerShell exemple :</p>
                    <pre className="text-xs overflow-x-auto">
{`# export-to-arthur.ps1
# 1. Exporter depuis votre logiciel (commande CLI)
& "C:\\Pharma\\export.exe" --format json

# 2. Envoyer à Arthur
$json = Get-Content products.json
Invoke-WebRequest -Uri "${apiEndpoint}" \\
  -Method POST \\
  -Headers @{
    "Authorization" = "Bearer VOTRE_TOKEN"
    "Content-Type" = "application/json"
  } \\
  -Body $json`}
                    </pre>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Planifiez ce script pour qu'il s'exécute toutes les heures via le Planificateur de tâches Windows.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Option 3 : Service de synchronisation Arthur</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Pour une solution clé en main, consultez l'onglet "Clé en main" pour demander l'installation du service.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Documentation API */}
            <TabsContent value="api" className="space-y-4">
              <Alert>
                <AlertDescription>
                  Intégrez l'API Arthur dans votre système pour une synchronisation en temps réel.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Endpoint API</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-xs font-mono break-all">POST {apiEndpoint}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Authentification</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Vous devez vous authentifier avec votre compte pharmacien pour utiliser l'API.
                  </p>
                  <div className="bg-muted p-3 rounded-md">
                    <pre className="text-xs overflow-x-auto">
{`# 1. Se connecter pour obtenir un token
curl -X POST '${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password' \\
  -H 'apikey: VOTRE_ANON_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "email": "votre.email@pharmacie.com",
    "password": "votre_mot_de_passe"
  }'

# Récupérer le "access_token" de la réponse`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Format de la requête</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <pre className="text-xs overflow-x-auto">
{`curl -X POST '${apiEndpoint}' \\
  -H 'Authorization: Bearer VOTRE_ACCESS_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "pharmacy_id": "${pharmacyId}",
    "products": [
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
    ]
  }'`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Réponse</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <pre className="text-xs overflow-x-auto">
{`{
  "success": true,
  "results": {
    "created": 5,
    "updated": 12,
    "errors": []
  }
}`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Exemple Node.js</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <pre className="text-xs overflow-x-auto">
{`const syncProducts = async (products) => {
  // 1. Authentification
  const authRes = await fetch(
    '${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      headers: {
        'apikey': 'VOTRE_ANON_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'votre.email@pharmacie.com',
        password: 'votre_mot_de_passe'
      })
    }
  );
  
  const { access_token } = await authRes.json();

  // 2. Synchronisation
  const syncRes = await fetch('${apiEndpoint}', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pharmacy_id: '${pharmacyId}',
      products: products
    })
  });

  return await syncRes.json();
};`}
                    </pre>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Solution clé en main */}
            <TabsContent value="turnkey" className="space-y-4">
              <Alert>
                <AlertDescription>
                  La solution premium pour une synchronisation sans effort. Notre équipe installe et configure tout pour vous.
                </AlertDescription>
              </Alert>

              <TurnkeySolutionContact pharmacyId={pharmacyId} />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comment ça fonctionne ?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold">
                      1
                    </div>
                    <div>
                      <p className="font-semibold">Vous remplissez le formulaire</p>
                      <p className="text-muted-foreground text-xs">
                        Indiquez-nous vos coordonnées et votre logiciel de gestion
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold">
                      2
                    </div>
                    <div>
                      <p className="font-semibold">Notre équipe vous contacte</p>
                      <p className="text-muted-foreground text-xs">
                        Sous 24-48h, un technicien planifie l'installation avec vous
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold">
                      3
                    </div>
                    <div>
                      <p className="font-semibold">Installation sur site</p>
                      <p className="text-muted-foreground text-xs">
                        Un connecteur est installé et configuré directement dans votre pharmacie
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold">
                      4
                    </div>
                    <div>
                      <p className="font-semibold">Synchronisation automatique activée</p>
                      <p className="text-muted-foreground text-xs">
                        Vos produits, stocks et prix sont synchronisés en temps réel avec Arthur
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">✅ Avantages de la solution clé en main :</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Aucune compétence technique requise</li>
                      <li>• Installation et configuration par nos experts</li>
                      <li>• Compatible avec tous les logiciels de gestion</li>
                      <li>• Synchronisation bidirectionnelle (produits + commandes)</li>
                      <li>• Mises à jour automatiques du connecteur</li>
                      <li>• Support technique prioritaire</li>
                      <li>• Garantie de bon fonctionnement</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Besoin d'aide ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Notre équipe technique peut vous aider à configurer la synchronisation automatique.</p>
          <p>📧 Email : support-pharmacie@arthur.fr</p>
          <p>📞 Téléphone : 01 XX XX XX XX</p>
          <p>⏰ Disponible du lundi au vendredi, 9h-18h</p>
        </CardContent>
      </Card>
    </div>
  );
}
