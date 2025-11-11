import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Permission {
  id: string;
  role: string;
  permission_key: string;
  allowed: boolean;
}

interface PermissionsByRole {
  [role: string]: { [key: string]: boolean };
}

const permissionLabels: Record<string, string> = {
  view_dashboard: "Voir le tableau de bord",
  manage_team: "Gérer l'équipe",
  manage_promotions: "Gérer les promotions",
  manage_products: "Gérer les produits",
  manage_orders: "Gérer les commandes",
  manage_api_keys: "Gérer les clés API",
  manage_connectors: "Gérer les connecteurs",
};

const roleLabels: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  promotion_manager: "Gestionnaire de promotions",
};

const AdminPermissions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionsByRole>({});
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndLoadPermissions();
  }, []);

  const checkAdminAndLoadPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/pharmacy-login');
        return;
      }

      // Vérifier si l'utilisateur est admin
      const { data: adminRole } = await supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminRole) {
        toast({
          title: "Accès refusé",
          description: "Vous n'avez pas les droits d'administration",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      await loadPermissions();
    } catch (error: any) {
      console.error('Error checking admin:', error);
      navigate('/');
    }
  };

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role')
        .order('permission_key');

      if (error) throw error;

      // Organiser par rôle
      const grouped: PermissionsByRole = {};
      (data || []).forEach((perm: Permission) => {
        if (!grouped[perm.role]) {
          grouped[perm.role] = {};
        }
        grouped[perm.role][perm.permission_key] = perm.allowed;
      });

      setPermissions(grouped);
    } catch (error: any) {
      console.error('Error loading permissions:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (role: string, permissionKey: string) => {
    try {
      const currentValue = permissions[role]?.[permissionKey] ?? false;
      const newValue = !currentValue;

      const { error } = await supabase
        .from('role_permissions')
        .upsert({
          role: role as any,
          permission_key: permissionKey,
          allowed: newValue,
        }, {
          onConflict: 'role,permission_key'
        });

      if (error) throw error;

      // Mettre à jour l'état local
      setPermissions(prev => ({
        ...prev,
        [role]: {
          ...prev[role],
          [permissionKey]: newValue,
        }
      }));

      toast({
        title: "Permission mise à jour",
        description: `${permissionLabels[permissionKey]} ${newValue ? 'activée' : 'désactivée'} pour ${roleLabels[role]}`,
      });
    } catch (error: any) {
      console.error('Error updating permission:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la permission",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/pharmacies')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Gestion des Permissions
            </h1>
            <p className="text-muted-foreground">
              Configurez les autorisations par rôle
            </p>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Chargement des permissions...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Permissions par Rôle</CardTitle>
              <CardDescription>
                Activez ou désactivez les permissions pour chaque rôle. Les changements sont appliqués immédiatement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Permission</TableHead>
                      {Object.keys(roleLabels).map(role => (
                        <TableHead key={role} className="text-center">
                          <Badge variant="outline">{roleLabels[role]}</Badge>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.keys(permissionLabels).map(permKey => (
                      <TableRow key={permKey}>
                        <TableCell className="font-medium">
                          {permissionLabels[permKey]}
                        </TableCell>
                        {Object.keys(roleLabels).map(role => (
                          <TableCell key={role} className="text-center">
                            <Switch
                              checked={permissions[role]?.[permKey] ?? false}
                              onCheckedChange={() => togglePermission(role, permKey)}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-2">ℹ️ Information</h4>
                <p className="text-sm text-muted-foreground">
                  Ces permissions définissent les actions autorisées pour chaque rôle dans le back-office des pharmacies.
                  Les modifications prennent effet immédiatement pour tous les utilisateurs ayant ces rôles.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminPermissions;
