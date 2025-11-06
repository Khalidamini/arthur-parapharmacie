import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email: string;
  created_at: string;
}

interface PharmacyTeamManagementProps {
  pharmacyId: string;
  userRole: string | null;
}

const PharmacyTeamManagement = ({ pharmacyId, userRole }: PharmacyTeamManagementProps) => {
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'viewer',
  });

  useEffect(() => {
    loadTeamMembers();
  }, [pharmacyId]);

  const loadTeamMembers = async () => {
    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at')
        .eq('pharmacy_id', pharmacyId);

      if (error) throw error;

      // Get user emails
      const membersWithEmails = await Promise.all(
        (roles || []).map(async (role) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', role.user_id)
            .single();

          return {
            ...role,
            email: profile?.email || 'Email inconnu',
          };
        })
      );

      setTeamMembers(membersWithEmails);
    } catch (error: any) {
      console.error('Error loading team:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'équipe.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke('send-pharmacy-invitation', {
        body: {
          email: inviteForm.email,
          role: inviteForm.role,
          pharmacyId: pharmacyId,
        },
      });

      if (error) throw error;

      toast({
        title: "Invitation envoyée",
        description: "Une invitation a été envoyée par email. Si l'utilisateur a déjà un compte, il a été ajouté directement.",
      });

      setInviteDialogOpen(false);
      setInviteForm({ email: '', role: 'viewer' });
      loadTeamMembers();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'invitation.",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Membre retiré",
        description: "Le membre a été retiré de votre équipe.",
      });

      loadTeamMembers();
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: 'Propriétaire',
      admin: 'Administrateur',
      product_manager: 'Gestionnaire de produits',
      promotion_manager: 'Gestionnaire de promotions',
      viewer: 'Visualisation',
    };
    return labels[role] || role;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestion de l'équipe</CardTitle>
              <CardDescription>
                Gérez les utilisateurs et leurs permissions
              </CardDescription>
            </div>
            {(userRole === 'owner' || userRole === 'admin') && (
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Inviter un membre
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun membre dans l'équipe
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Date d'ajout</TableHead>
                  {(userRole === 'owner' || userRole === 'admin') && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {getRoleLabel(member.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    {(userRole === 'owner' || userRole === 'admin') && (
                      <TableCell className="text-right">
                        {member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un membre</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau membre à votre équipe. Si l'utilisateur n'a pas encore de compte, il recevra une invitation par email.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email du membre</Label>
              <Input
                id="email"
                type="email"
                placeholder="membre@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Rôle</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="product_manager">Gestionnaire de produits</SelectItem>
                  <SelectItem value="promotion_manager">Gestionnaire de promotions</SelectItem>
                  <SelectItem value="viewer">Visualisation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteForm.email}>
              {inviting ? "Invitation..." : "Inviter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PharmacyTeamManagement;
