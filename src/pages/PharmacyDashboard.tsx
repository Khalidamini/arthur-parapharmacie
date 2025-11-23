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
    <PharmacyLayout pharmacyName={pharmacyData?.name} pharmacyId={pharmacyId || undefined}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={() => navigate('/pharmacy-pickup-orders')} 
            className="w-full sm:w-auto"
          >
            <Package className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Commandes à Emporter</span>
            <span className="sm:hidden">À Emporter</span>
          </Button>
          <Button 
            onClick={() => navigate('/pharmacy-delivery-orders')} 
            className="w-full sm:w-auto" 
            variant="secondary"
          >
            <Package className="mr-2 h-4 w-4" />
            Livraisons
          </Button>
        </div>

        <Tabs defaultValue="info" className="space-y-4 sm:space-y-6">
          <div className="w-full overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <TabsList className="inline-flex sm:grid w-max sm:w-full min-w-full sm:min-w-0 sm:grid-cols-3 lg:grid-cols-6 h-auto p-1">
              <TabsTrigger value="info" className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Info</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Produits</span>
              </TabsTrigger>
              <TabsTrigger value="promotions" className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Promos</span>
              </TabsTrigger>
              <TabsTrigger value="sync" className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Sync</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Équipe</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Journal</span>
              </TabsTrigger>
            </TabsList>
          </div>

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
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Catalogue produits</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Gérez votre catalogue de produits et créez des promotions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                {pharmacyId && <PharmacyProductsList pharmacyId={pharmacyId} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gestion des promotions */}
          <TabsContent value="promotions">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Promotions actives</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Gérez vos promotions affichées dans l'application Arthur
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                <p className="text-xs sm:text-sm text-muted-foreground">
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
