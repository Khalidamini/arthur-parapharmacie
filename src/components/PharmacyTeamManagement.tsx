import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Trash2, Edit, Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email: string;
  created_at: string;
  must_change_password: boolean;
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
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'owner' | 'promotion_manager'>('admin');
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'admin',
  });

  useEffect(() => {
    loadTeamMembers();
  }, [pharmacyId]);

  const loadTeamMembers = async () => {
    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at, must_change_password')
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
    // Validation email
    try {
      const emailSchema = z
        .string()
        .trim()
        .min(1, { message: "Email requis" })
        .max(255, { message: "Email trop long" })
        .email({ message: "Adresse e-mail invalide" })
        .refine((v) => /^[\x00-\x7F]+$/.test(v), {
          message: "Adresse e-mail invalide: accents non supportés",
        });
      emailSchema.parse(inviteForm.email);
    } catch (e: any) {
      toast({ 
        title: "Email invalide", 
        description: e?.errors?.[0]?.message || "Vérifiez l'adresse e-mail.", 
        variant: "destructive" 
      });
      return;
    }

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-team-member', {
        body: {
          email: inviteForm.email.trim(),
          role: inviteForm.role,
          pharmacyId: pharmacyId,
        },
      });

      if (error) throw error;

      const temporaryPassword = (data as any)?.temporaryPassword;
      if (temporaryPassword) {
        try { 
          const message = `Identifiants de connexion:\nEmail: ${inviteForm.email}\nMot de passe provisoire: ${temporaryPassword}\n\nLe membre devra changer son mot de passe lors de sa première connexion.`;
          await navigator.clipboard.writeText(message); 
          toast({
            title: "Membre invité",
            description: "Les identifiants ont été copiés dans le presse-papiers. Un email a également été envoyé.",
          });
        } catch {
          toast({
            title: "Membre invité",
            description: `Mot de passe provisoire: ${temporaryPassword}. Communiquez-le au membre.`,
          });
        }
      }

      setInviteDialogOpen(false);
      setInviteForm({ email: '', role: 'admin' });
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

  const handleRemoveMember = async (memberId: string, memberRole: string) => {
    if (memberRole === 'owner') {
      toast({
        title: "Action impossible",
        description: "Vous ne pouvez pas retirer un propriétaire.",
        variant: "destructive",
      });
      return;
    }

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
      promotion_manager: 'Gestionnaire de promotions',
    };
    return labels[role] || role;
  };

  const handleOpenEditRole = (member: TeamMember) => {
    if (member.role === 'owner') {
      toast({
        title: "Action impossible",
        description: "Vous ne pouvez pas modifier le rôle d'un propriétaire.",
        variant: "destructive",
      });
      return;
    }
    setSelectedMember(member);
    setNewRole(member.role as 'admin' | 'owner' | 'promotion_manager');
    setEditRoleDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedMember || !newRole) return;

    setUpdatingRole(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('id', selectedMember.id);

      if (error) throw error;

      toast({
        title: "Rôle modifié",
        description: "Le rôle du membre a été modifié avec succès.",
      });

      setEditRoleDialogOpen(false);
      setSelectedMember(null);
      loadTeamMembers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la modification.",
        variant: "destructive",
      });
    } finally {
      setUpdatingRole(false);
    }
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
              <li>• <strong>Administrateur</strong> : Gestion complète de la pharmacie</li>
              <li>• <strong>Gestionnaire de promotions</strong> : Création et modification des promotions uniquement</li>
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
                  <TableHead>Statut</TableHead>
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
                      {member.must_change_password ? (
                        <Badge variant="outline" className="text-amber-600">
                          Mot de passe provisoire
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">
                          Actif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    {(userRole === 'owner' || userRole === 'admin') && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditRole(member)}
                            disabled={member.role === 'owner'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, member.role)}
                            disabled={member.role === 'owner'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
              Un compte sera créé avec un mot de passe provisoire. Le membre devra le changer lors de sa première connexion.
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
                  <SelectItem value="promotion_manager">Gestionnaire de promotions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteDialogOpen(false);
                setInviteForm({ email: '', role: 'admin' });
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? 'Invitation...' : 'Inviter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Modifiez le rôle de {selectedMember?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-role">Nouveau rôle</Label>
              <Select
                value={newRole}
                onValueChange={(value: any) => setNewRole(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="promotion_manager">Gestionnaire de promotions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditRoleDialogOpen(false);
                setSelectedMember(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleUpdateRole} disabled={updatingRole}>
              {updatingRole ? 'Modification...' : 'Modifier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PharmacyTeamManagement;
