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
import { usePharmacyActivityLog } from "@/hooks/usePharmacyActivityLog";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  must_change_password: boolean;
}

interface PharmacyTeamManagementProps {
  pharmacyId: string;
  userRole: string | null;
}

const PharmacyTeamManagement = ({ pharmacyId, userRole }: PharmacyTeamManagementProps) => {
  const { toast } = useToast();
  const { logActivity } = usePharmacyActivityLog();
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

      // Get user emails and names
      const membersWithEmails = await Promise.all(
        (roles || []).map(async (role) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name, phone')
            .eq('id', role.user_id)
            .maybeSingle();

          return {
            ...role,
            email: profile?.email || 'Email inconnu',
            first_name: profile?.first_name || null,
            last_name: profile?.last_name || null,
            phone: profile?.phone || null,
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
      const emailSent = (data as any)?.emailSent !== false;
      const emailErrorMessage = (data as any)?.emailErrorMessage as string | undefined;

      if (temporaryPassword) {
        try {
          const message = `Identifiants de connexion:\nEmail: ${inviteForm.email}\nMot de passe provisoire: ${temporaryPassword}\n\nLe membre devra changer son mot de passe lors de sa première connexion.`;
          await navigator.clipboard.writeText(message);
          toast({
            title: "Membre invité",
            description: emailSent ?
              "Les identifiants ont été copiés dans le presse-papiers. Un email a également été envoyé." :
              "Les identifiants ont été copiés dans le presse-papiers. L'email n'a pas pu être envoyé (configuration domaine nécessaire).",
          });
        } catch {
          toast({
            title: "Membre invité",
            description: emailSent ?
              `Mot de passe provisoire: ${temporaryPassword}. Un email a été envoyé.` :
              `Mot de passe provisoire: ${temporaryPassword}. Email non envoyé, communiquez ces identifiants manuellement.`,
          });
        }
      } else {
        // Compte existant: pas de mot de passe provisoire
        toast({
          title: "Membre ajouté",
          description: emailSent ?
            "Le membre peut se connecter avec son mot de passe actuel. Un email d'information a été envoyé." :
            "Le membre est ajouté. Email non envoyé (vérifiez la configuration d'envoi).",
        });
      }

      if (!emailSent && emailErrorMessage) {
        console.error('Invitation email not sent:', emailErrorMessage);
      }

      // Log l'activité
      await logActivity({
        pharmacyId,
        actionType: 'team_member_invited',
        actionDetails: { email: inviteForm.email, role: inviteForm.role },
        entityType: 'user_role',
      });

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

      // Log l'activité
      await logActivity({
        pharmacyId,
        actionType: 'team_member_removed',
        entityType: 'user_role',
        entityId: memberId,
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

      // Log l'activité
      await logActivity({
        pharmacyId,
        actionType: 'team_member_role_changed',
        actionDetails: { oldRole: selectedMember.role, newRole },
        entityType: 'user_role',
        entityId: selectedMember.id,
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-xl">Gestion de l'équipe</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Gérez les utilisateurs et leurs permissions
              </CardDescription>
            </div>
            {(userRole === 'owner' || userRole === 'admin') && (
              <Button onClick={() => setInviteDialogOpen(true)} className="w-full sm:w-auto shrink-0">
                <UserPlus className="mr-2 h-4 w-4" />
                <span className="sm:inline">Inviter</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-3 sm:p-4 bg-muted/50">
            <h4 className="font-semibold mb-2 text-sm sm:text-base">Rôles disponibles :</h4>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <li>• <strong>Propriétaire</strong> : Accès complet</li>
              <li>• <strong>Administrateur</strong> : Gestion complète</li>
              <li>• <strong>Gestionnaire de promotions</strong> : Gestion promotions</li>
            </ul>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucun membre dans l'équipe
            </div>
          ) : (
            <>
              {/* Vue desktop - Tableau */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Téléphone</TableHead>
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
                        <TableCell className="font-medium">
                          {member.first_name && member.last_name 
                            ? `${member.first_name} ${member.last_name}`
                            : <span className="text-muted-foreground italic">Non renseigné</span>
                          }
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          {member.phone || <span className="text-muted-foreground italic">Non renseigné</span>}
                        </TableCell>
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
              </div>

              {/* Vue mobile - Cartes */}
              <div className="md:hidden space-y-3">
                {teamMembers.map((member) => (
                  <Card key={member.id} className="border-l-4 border-l-primary/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {member.first_name && member.last_name 
                              ? `${member.first_name} ${member.last_name}`
                              : <span className="text-muted-foreground italic">Non renseigné</span>
                            }
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{member.email}</p>
                        </div>
                        <Badge variant={getRoleBadgeVariant(member.role)} className="shrink-0 text-xs">
                          {getRoleLabel(member.role)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Téléphone</span>
                          <p className="font-medium truncate">
                            {member.phone || <span className="text-muted-foreground italic">Non renseigné</span>}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ajouté le</span>
                          <p className="font-medium">
                            {new Date(member.created_at).toLocaleDateString('fr-FR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        {member.must_change_password ? (
                          <Badge variant="outline" className="text-amber-600 text-xs">
                            Mot de passe provisoire
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 text-xs">
                            Actif
                          </Badge>
                        )}

                        {(userRole === 'owner' || userRole === 'admin') && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditRole(member)}
                              disabled={member.role === 'owner'}
                              className="h-8 px-2"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id, member.role)}
                              disabled={member.role === 'owner'}
                              className="h-8 px-2"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Inviter un membre</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Un compte sera créé avec un mot de passe provisoire. Le membre devra le changer lors de sa première connexion.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:gap-4 py-3 sm:py-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-sm">Email du membre</Label>
              <Input
                id="email"
                type="email"
                placeholder="membre@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                className="text-sm"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role" className="text-sm">Rôle</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" className="text-sm">Administrateur</SelectItem>
                  <SelectItem value="promotion_manager" className="text-sm">Gestionnaire de promotions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setInviteDialogOpen(false);
                setInviteForm({ email: '', role: 'admin' });
              }}
              className="w-full sm:w-auto text-sm"
            >
              Annuler
            </Button>
            <Button onClick={handleInvite} disabled={inviting} className="w-full sm:w-auto text-sm">
              {inviting ? 'Invitation...' : 'Inviter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Modifier le rôle</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              Modifiez le rôle de {selectedMember?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:gap-4 py-3 sm:py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-role" className="text-sm">Nouveau rôle</Label>
              <Select
                value={newRole}
                onValueChange={(value: any) => setNewRole(value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" className="text-sm">Administrateur</SelectItem>
                  <SelectItem value="promotion_manager" className="text-sm">Gestionnaire de promotions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditRoleDialogOpen(false);
                setSelectedMember(null);
              }}
              className="w-full sm:w-auto text-sm"
            >
              Annuler
            </Button>
            <Button onClick={handleUpdateRole} disabled={updatingRole} className="w-full sm:w-auto text-sm">
              {updatingRole ? 'Modification...' : 'Modifier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PharmacyTeamManagement;
