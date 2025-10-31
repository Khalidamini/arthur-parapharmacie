import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Package, Tag, Upload } from "lucide-react";
import PharmacyLayout from '@/layouts/PharmacyLayout';
import PharmacyProductsList from '@/components/PharmacyProductsList';
import PharmacyPromotionsList from '@/components/PharmacyPromotionsList';
import ProductImportWizard from '@/components/ProductImportWizard';

const PharmacyDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [pharmacyData, setPharmacyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      setUser(user);

      // Vérifier les rôles de l'utilisateur
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role, pharmacy_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      }

      if (!roles) {
        toast({
          title: "Accès non autorisé",
          description: "Vous n'avez pas les permissions nécessaires pour accéder à cette page.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setUserRole(roles.role);
      setPharmacyId(roles.pharmacy_id);

      // Charger les données de la pharmacie
      const { data: pharmacy, error: pharmacyError } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('id', roles.pharmacy_id)
        .single();

      if (pharmacyError) {
        console.error('Error fetching pharmacy:', pharmacyError);
      } else {
        setPharmacyData(pharmacy);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <PharmacyLayout pharmacyName={pharmacyData?.name}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button onClick={() => navigate('/pharmacy-orders')} className="mb-4">
            <Package className="mr-2 h-4 w-4" />
            Voir les commandes clients
          </Button>
        </div>

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="info">
              <Building2 className="mr-2 h-4 w-4" />
              Informations
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="mr-2 h-4 w-4" />
              Produits
            </TabsTrigger>
            <TabsTrigger value="promotions">
              <Tag className="mr-2 h-4 w-4" />
              Promotions
            </TabsTrigger>
            <TabsTrigger value="sync">
              <Upload className="mr-2 h-4 w-4" />
              Synchronisation
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="mr-2 h-4 w-4" />
              Équipe
            </TabsTrigger>
          </TabsList>

          {/* Informations de la pharmacie */}
          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>Informations de l'établissement</CardTitle>
                <CardDescription>
                  Gérez les informations de votre pharmacie
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pharmacyData ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Nom</p>
                        <p className="font-medium">{pharmacyData.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Téléphone</p>
                        <p className="font-medium">{pharmacyData.phone || 'Non renseigné'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Adresse</p>
                        <p className="font-medium">{pharmacyData.address}</p>
                        <p className="font-medium">{pharmacyData.postal_code} {pharmacyData.city}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Code QR</p>
                        <p className="font-mono font-medium">{pharmacyData.qr_code}</p>
                      </div>
                    </div>
                    <Button className="mt-4">
                      Modifier les informations
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">Chargement...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gestion des produits */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Catalogue produits</CardTitle>
                <CardDescription>
                  Gérez votre catalogue de produits et créez des promotions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {pharmacyId && <PharmacyProductsList pharmacyId={pharmacyId} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gestion des promotions */}
          <TabsContent value="promotions">
            <Card>
              <CardHeader>
                <CardTitle>Promotions actives</CardTitle>
                <CardDescription>
                  Gérez vos promotions affichées dans l'application Arthur
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Les promotions sont affichées dans le slider de l'application Arthur pour vos clients.
                  Pour créer une promotion, allez dans l'onglet Produits.
                </p>
                {pharmacyId && <PharmacyPromotionsList pharmacyId={pharmacyId} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import du catalogue */}
          <TabsContent value="sync">
            {pharmacyId && <ProductImportWizard pharmacyId={pharmacyId} />}
          </TabsContent>

          {/* Gestion de l'équipe */}
          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Gestion de l'équipe</CardTitle>
                <CardDescription>
                  Gérez les utilisateurs et leurs permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="font-semibold mb-2">Rôles disponibles :</h4>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Propriétaire</strong> : Accès complet à toutes les fonctionnalités</li>
                      <li>• <strong>Administrateur</strong> : Gestion complète sauf suppression de la pharmacie</li>
                      <li>• <strong>Gestionnaire de produits</strong> : Gestion du catalogue et des stocks</li>
                      <li>• <strong>Gestionnaire de promotions</strong> : Création et modification des promotions</li>
                      <li>• <strong>Visualisation</strong> : Accès en lecture seule</li>
                    </ul>
                  </div>
                  {(userRole === 'owner' || userRole === 'admin') && (
                    <Button>
                      <Users className="mr-2 h-4 w-4" />
                      Inviter un membre
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PharmacyLayout>
  );
};

export default PharmacyDashboard;
