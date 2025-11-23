import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, CheckCircle2, AlertCircle, Monitor, Package, Zap } from "lucide-react";
import PharmacyLayout from "@/layouts/PharmacyLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function PharmacyConnectorDownload() {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadPharmacyId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/pharmacy-login');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('pharmacy_id')
        .eq('user_id', user.id)
        .single();

      if (roleData) {
        setPharmacyId(roleData.pharmacy_id);
      }
    };

    loadPharmacyId();
  }, []);

  const handleDownload = () => {
    setDownloadStarted(true);
    // Le connecteur sera bientôt disponible en téléchargement
    // En attendant, on affiche le message de confirmation sans lien externe
  };

  return (
    <PharmacyLayout pharmacyId={pharmacyId || undefined}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Connecteur Arthur</h1>
          <p className="text-muted-foreground">
            Installation automatique en 5 minutes - Sans compétences techniques
          </p>
        </div>

        {/* Avantages */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Zap className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">5 minutes chrono</h3>
              <p className="text-sm text-muted-foreground">
                Installation complète en moins de 5 minutes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Monitor className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">100% automatique</h3>
              <p className="text-sm text-muted-foreground">
                Détecte votre logiciel et se configure tout seul
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Package className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Zéro technique</h3>
              <p className="text-sm text-muted-foreground">
                Guide visuel pas à pas, impossible de se tromper
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bouton de téléchargement */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Étape 1 : Télécharger le connecteur</CardTitle>
            <CardDescription className="text-center">
              Compatible Windows 10/11 et macOS (version 12+)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Button 
                size="lg" 
                onClick={handleDownload}
                className="text-lg px-8 py-6"
              >
                <Download className="mr-2 h-5 w-5" />
                Télécharger Arthur Connecteur
                <span className="ml-2 text-xs opacity-75">(8.5 MB)</span>
              </Button>
            </div>

            {downloadStarted && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Connecteur bientôt disponible !</strong> En attendant, nous vous proposons notre solution clé en main avec installation par un technicien. Contactez-nous via l'onglet "Clé en main" du guide de synchronisation.
                </AlertDescription>
              </Alert>
            )}

            <div className="text-center text-sm text-muted-foreground space-y-1">
              <p>✓ Gratuit - Aucun engagement</p>
              <p>✓ Installation en 1 clic</p>
              <p>✓ Désinstallation propre à tout moment</p>
            </div>
          </CardContent>
        </Card>

        {/* Guide d'installation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Étape 2 : Installation guidée</CardTitle>
            <CardDescription>
              Suivez ces étapes dans l'ordre. Chaque action est expliquée en détail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="step-1" className="w-full">
              {/* Étape 1 */}
              <AccordionItem value="step-1">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      1
                    </div>
                    <span>Ouvrir le fichier téléchargé</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Où trouver le fichier ?</strong> Il se trouve dans votre dossier "Téléchargements"
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-semibold">Ouvrez votre explorateur de fichiers</p>
                        <p className="text-muted-foreground">
                          <kbd className="px-2 py-1 bg-background rounded border">Windows + E</kbd> sur Windows
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        2
                      </div>
                      <div>
                        <p className="font-semibold">Cliquez sur "Téléchargements" dans le menu de gauche</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        3
                      </div>
                      <div>
                        <p className="font-semibold">Cherchez le fichier <code className="bg-background px-2 py-1 rounded">arthur-connecteur.exe</code></p>
                        <p className="text-muted-foreground">C'est le dernier fichier téléchargé, il apparaît en haut</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        4
                      </div>
                      <div>
                        <p className="font-semibold">Double-cliquez sur le fichier</p>
                      </div>
                    </div>
                  </div>

                  <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      <strong>Windows peut afficher un avertissement de sécurité</strong><br/>
                      C'est normal ! Cliquez sur "Plus d'infos" puis "Exécuter quand même"
                    </AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              {/* Étape 2 */}
              <AccordionItem value="step-2">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      2
                    </div>
                    <span>L'assistant s'ouvre automatiquement</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="border-2 border-dashed rounded-lg p-6 bg-muted/50">
                    <div className="text-center space-y-2">
                      <div className="text-4xl">🎯</div>
                      <h4 className="font-semibold text-lg">Assistant Arthur - Bienvenue</h4>
                      <p className="text-sm text-muted-foreground">
                        L'assistant va maintenant détecter automatiquement votre logiciel de pharmacie
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <p className="font-semibold">Ce que l'assistant va faire :</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Chercher Pharmagest, LGPI, Winpharma sur votre ordinateur</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Vous demander votre identifiant pharmacien Arthur</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Configurer la connexion automatiquement</span>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription>
                      <strong>Cliquez simplement sur "Suivant"</strong> à chaque étape. L'assistant fait tout le travail !
                    </AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              {/* Étape 3 */}
              <AccordionItem value="step-3">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      3
                    </div>
                    <span>Connexion à votre compte Arthur</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="border-2 border-primary/20 rounded-lg p-6 bg-primary/5">
                    <div className="space-y-4">
                      <h4 className="font-semibold">L'assistant vous demande :</h4>
                      <div className="space-y-3">
                        <div className="bg-background p-3 rounded-lg">
                          <Label className="text-sm font-semibold mb-2 block">Email de connexion</Label>
                          <div className="text-sm text-muted-foreground">
                            Entrez l'email que vous utilisez pour vous connecter à Arthur
                          </div>
                        </div>
                        <div className="bg-background p-3 rounded-lg">
                          <Label className="text-sm font-semibold mb-2 block">Mot de passe</Label>
                          <div className="text-sm text-muted-foreground">
                            Le même mot de passe que sur le site Arthur
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Sécurité maximale :</strong> Vos identifiants sont chiffrés et stockés uniquement sur votre ordinateur.
                    </AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              {/* Étape 4 */}
              <AccordionItem value="step-4">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      4
                    </div>
                    <span>Détection automatique de votre logiciel</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="border-2 border-dashed rounded-lg p-6 bg-muted/50 text-center">
                    <div className="space-y-3">
                      <div className="text-4xl animate-pulse">🔍</div>
                      <p className="font-semibold">Recherche en cours...</p>
                      <p className="text-sm text-muted-foreground">
                        L'assistant cherche Pharmagest, LGPI, Winpharma sur votre ordinateur
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="font-semibold text-sm">3 scénarios possibles :</p>
                    
                    <div className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-sm">Logiciel détecté automatiquement</span>
                      </div>
                      <p className="text-sm text-muted-foreground pl-7">
                        → Parfait ! Cliquez sur "Suivant", tout est déjà configuré
                      </p>
                    </div>

                    <div className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                        <span className="font-semibold text-sm">Plusieurs logiciels trouvés</span>
                      </div>
                      <p className="text-sm text-muted-foreground pl-7">
                        → Choisissez celui que vous utilisez dans la liste proposée
                      </p>
                    </div>

                    <div className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-sm">Aucun logiciel détecté</span>
                      </div>
                      <p className="text-sm text-muted-foreground pl-7">
                        → Cliquez sur "Choisir manuellement" et sélectionnez le dossier où est installé votre logiciel
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Étape 5 */}
              <AccordionItem value="step-5">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      5
                    </div>
                    <span>Test de connexion</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="border-2 border-primary rounded-lg p-6 bg-primary/5">
                    <div className="space-y-4 text-center">
                      <div className="text-4xl">⚡</div>
                      <h4 className="font-semibold">Test en cours...</h4>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>✓ Connexion à votre logiciel de pharmacie</p>
                        <p>✓ Lecture de quelques produits de test</p>
                        <p>✓ Envoi vers Arthur</p>
                      </div>
                    </div>
                  </div>

                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Si le test réussit :</strong> Vous verrez "✓ Connexion réussie" en vert
                    </AlertDescription>
                  </Alert>

                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>Si le test échoue :</strong> L'assistant vous proposera automatiquement des solutions (vérifier les identifiants, choisir un autre dossier, etc.)
                    </AlertDescription>
                  </Alert>
                </AccordionContent>
              </AccordionItem>

              {/* Étape 6 */}
              <AccordionItem value="step-6">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white font-bold">
                      ✓
                    </div>
                    <span>C'est terminé !</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="border-2 border-green-600 rounded-lg p-6 bg-green-50 text-center">
                    <div className="space-y-3">
                      <div className="text-5xl">🎉</div>
                      <h4 className="font-semibold text-xl text-green-900">Installation réussie !</h4>
                      <p className="text-sm text-green-800">
                        Vos produits sont maintenant synchronisés automatiquement toutes les 15 minutes
                      </p>
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Que se passe-t-il maintenant ?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-semibold">Synchronisation automatique activée</p>
                          <p className="text-muted-foreground text-xs">
                            Le connecteur tourne en arrière-plan et synchronise vos produits toutes les 15 minutes
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-semibold">Icône dans la barre des tâches</p>
                          <p className="text-muted-foreground text-xs">
                            Une petite icône Arthur apparaît en bas à droite de votre écran
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-semibold">Notification de synchronisation</p>
                          <p className="text-muted-foreground text-xs">
                            Vous recevrez une petite notification à chaque synchronisation réussie
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-semibold">Démarrage automatique</p>
                          <p className="text-muted-foreground text-xs">
                            Le connecteur se lance automatiquement au démarrage de Windows
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Questions fréquentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="faq-1">
                <AccordionTrigger>Mon logiciel n'est pas détecté, que faire ?</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm">
                  <p>Si votre logiciel n'est pas détecté automatiquement :</p>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Cliquez sur "Choisir manuellement"</li>
                    <li>Naviguez vers le dossier d'installation (généralement <code className="bg-muted px-1 rounded">C:\Program Files\</code>)</li>
                    <li>Sélectionnez le dossier de votre logiciel (Pharmagest, LGPI, etc.)</li>
                    <li>L'assistant configurera la connexion à partir de là</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-2">
                <AccordionTrigger>Le test de connexion échoue, pourquoi ?</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm">
                  <p>Causes possibles :</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Identifiants incorrects</strong> : Vérifiez votre email et mot de passe Arthur</li>
                    <li><strong>Logiciel fermé</strong> : Votre logiciel de pharmacie doit être ouvert</li>
                    <li><strong>Pas de produits</strong> : Assurez-vous d'avoir au moins 1 produit dans votre catalogue</li>
                    <li><strong>Antivirus</strong> : Autorisez Arthur dans votre antivirus</li>
                  </ul>
                  <p className="mt-2">L'assistant vous guidera avec des solutions spécifiques selon l'erreur.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-3">
                <AccordionTrigger>Comment désinstaller le connecteur ?</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm">
                  <p>Désinstallation propre en 3 clics :</p>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Panneau de configuration → Programmes → Désinstaller un programme</li>
                    <li>Cherchez "Arthur Connecteur"</li>
                    <li>Clic droit → Désinstaller</li>
                  </ol>
                  <p className="mt-2">Aucun fichier résiduel n'est laissé sur votre ordinateur.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-4">
                <AccordionTrigger>Le connecteur ralentit-il mon ordinateur ?</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm">
                  <p>Non, le connecteur est ultra-léger :</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Utilise moins de 50 MB de mémoire RAM</li>
                    <li>Ne s'active que toutes les 15 minutes pendant quelques secondes</li>
                    <li>Reste en veille le reste du temps</li>
                    <li>Aucun impact sur les performances de votre logiciel de pharmacie</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-5">
                <AccordionTrigger>Puis-je modifier la fréquence de synchronisation ?</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm">
                  <p>Oui ! Faites un clic droit sur l'icône Arthur dans la barre des tâches :</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Paramètres → Fréquence de synchronisation</li>
                    <li>Choisissez entre 5 min, 15 min, 30 min, 1 heure</li>
                    <li>Ou déclenchez une synchronisation manuelle à tout moment</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <h3 className="font-semibold text-lg">Besoin d'aide pendant l'installation ?</h3>
              <p className="text-sm text-muted-foreground">
                Notre équipe est disponible pour vous guider en temps réel
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Button variant="outline" asChild>
                  <a href="tel:0123456789">📞 01 23 45 67 89</a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="mailto:support@arthur.fr">✉️ support@arthur.fr</a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Lundi - Vendredi : 9h - 18h
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PharmacyLayout>
  );
}

import { Label } from "@/components/ui/label";
