import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Package, Tag, Upload, Activity } from "lucide-react";
import PharmacyLayout from '@/layouts/PharmacyLayout';
import PharmacyProductsList from '@/components/PharmacyProductsList';
import PharmacyPromotionsList from '@/components/PharmacyPromotionsList';
import ConnectorDownload from '@/components/ConnectorDownload';
import PharmacyInfoEdit from '@/components/PharmacyInfoEdit';
import PharmacyTeamManagement from '@/components/PharmacyTeamManagement';
import PharmacyActivityLogs from '@/components/PharmacyActivityLogs';

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
        .limit(1)
        .single();

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
        <div className="mb-6 flex gap-4">
          <Button onClick={() => navigate('/pharmacy-pickup-orders')} className="mb-4">
            <Package className="mr-2 h-4 w-4" />
            Commandes à Emporter
          </Button>
          <Button onClick={() => navigate('/pharmacy-delivery-orders')} className="mb-4" variant="secondary">
            <Package className="mr-2 h-4 w-4" />
            Livraisons
          </Button>
        </div>

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
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
            <TabsTrigger value="logs">
              <Activity className="mr-2 h-4 w-4" />
              Journal
            </TabsTrigger>
          </TabsList>

          {/* Informations de la pharmacie */}
          <TabsContent value="info">
            {pharmacyData && pharmacyId && (
              <PharmacyInfoEdit 
                pharmacyData={pharmacyData} 
                pharmacyId={pharmacyId}
                onUpdate={(updatedData) => setPharmacyData(updatedData)}
              />
            )}
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

          {/* Connecteur automatique */}
          <TabsContent value="sync">
            {pharmacyId && <ConnectorDownload pharmacyId={pharmacyId} />}
          </TabsContent>

          {/* Gestion de l'équipe */}
          <TabsContent value="team">
            {pharmacyId && (
              <PharmacyTeamManagement 
                pharmacyId={pharmacyId} 
                userRole={userRole}
              />
            )}
          </TabsContent>

          {/* Journal des activités */}
          <TabsContent value="logs">
            {pharmacyId && <PharmacyActivityLogs pharmacyId={pharmacyId} />}
          </TabsContent>
        </Tabs>
      </div>
    </PharmacyLayout>
  );
};

export default PharmacyDashboard;
