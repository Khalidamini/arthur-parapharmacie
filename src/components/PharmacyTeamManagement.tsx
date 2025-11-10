import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Trash2, Edit } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email: string;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  status: string;
}

interface PharmacyTeamManagementProps {
  pharmacyId: string;
  userRole: string | null;
}

const PharmacyTeamManagement = ({ pharmacyId, userRole }: PharmacyTeamManagementProps) => {
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'owner' | 'product_manager' | 'promotion_manager' | 'viewer'>('viewer');
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'viewer',
  });

  useEffect(() => {
    loadTeamMembers();
    loadPendingInvitations();
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
    // Client-side validation to avoid invalid addresses (accents, bad format)
    try {
      const emailSchema = z
        .string()
        .trim()
        .min(1, { message: "Email requis" })
        .max(255, { message: "Email trop long" })
        .email({ message: "Adresse e-mail invalide" })
        .refine((v) => /^[\x00-\x7F]+$/.test(v), {
          message: "Adresse e-mail invalide: accents non supportés (ex: prive@gmail.com)",
        });
      emailSchema.parse(inviteForm.email);
    } catch (e: any) {
      toast({ title: "Email invalide", description: e?.errors?.[0]?.message || "Vérifiez l'adresse e-mail.", variant: "destructive" });
      return;
    }

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-pharmacy-invitation', {
        body: {
          email: inviteForm.email.trim(),
          role: inviteForm.role,
          pharmacyId: pharmacyId,
          baseUrl: window.location.origin,
        },
      });

      if (error) throw error;

      const delivery = (data as any)?.delivery;
      const invitationUrl = (data as any)?.invitationUrl;
      if (delivery === 'link' && invitationUrl) {
        try { await navigator.clipboard.writeText(invitationUrl); } catch {}
        toast({
          title: "Invitation prête",
          description: "Lien copié. Envoyez-le au membre depuis votre messagerie.",
        });
      } else {
        toast({
          title: "Invitation envoyée",
          description: "Une invitation a été envoyée par email.",
        });
      }

      setInviteDialogOpen(false);
      setInviteForm({ email: '', role: 'viewer' });
      loadTeamMembers();
      loadPendingInvitations();
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

  const loadPendingInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('pharmacy_invitations')
        .select('*')
        .eq('pharmacy_id', pharmacyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingInvitations(data || []);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('pharmacy_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitation annulée",
        description: "L'invitation a été annulée avec succès.",
      });

      loadPendingInvitations();
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'annulation.",
        variant: "destructive",
      });
    }
  };

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-pharmacy-invitation', {
        body: {
          email: invitation.email,
          role: invitation.role,
          pharmacyId: pharmacyId,
          baseUrl: window.location.origin,
        },
      });

      if (error) throw error;

      const delivery = (data as any)?.delivery;
      const invitationUrl = (data as any)?.invitationUrl;
      if (delivery === 'link' && invitationUrl) {
        try { await navigator.clipboard.writeText(invitationUrl); } catch {}
        toast({
          title: "Invitation prête",
          description: "Lien copié. Envoyez-le au membre depuis votre messagerie.",
        });
      } else {
        toast({
          title: "Invitation renvoyée",
          description: "L'invitation a été renvoyée par email.",
        });
      }
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du renvoi.",
        variant: "destructive",
      });
    }
  };

  const handleOpenEditRole = (member: TeamMember) => {
    setSelectedMember(member);
    setNewRole(member.role as 'admin' | 'owner' | 'product_manager' | 'promotion_manager' | 'viewer');
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
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditRole(member)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {(userRole === 'owner' || userRole === 'admin') && pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
            <CardDescription>
              Gérez les invitations qui n'ont pas encore été acceptées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Envoyée le</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getRoleLabel(invitation.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expires_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvitation(invitation)}
                        >
                          Renvoyer
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
              <Label htmlFor="role">Nouveau rôle</Label>
              <Select
                value={newRole}
                onValueChange={(value) => setNewRole(value as 'admin' | 'owner' | 'product_manager' | 'promotion_manager' | 'viewer')}
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
            <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateRole} disabled={updatingRole || !newRole}>
              {updatingRole ? "Modification..." : "Modifier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PharmacyTeamManagement;
