import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Mail, Lock, User } from "lucide-react";

interface InvitationData {
  pharmacy_name: string;
  role: string;
  email: string;
  token: string;
}

const PharmacyInvitation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    loadInvitation();
  }, []);

  const loadInvitation = async () => {
    try {
      const token = searchParams.get('token');
      if (!token) {
        toast({
          title: "Lien invalide",
          description: "Ce lien d'invitation est invalide.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      const { data: invitationData, error } = await supabase
        .from('pharmacy_invitations')
        .select(`
          email,
          role,
          token,
          status,
          expires_at,
          pharmacies (name)
        `)
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !invitationData) {
        toast({
          title: "Invitation introuvable",
          description: "Cette invitation n'existe pas ou a déjà été utilisée.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      // Check if expired
      if (new Date(invitationData.expires_at) < new Date()) {
        toast({
          title: "Invitation expirée",
          description: "Cette invitation a expiré. Veuillez demander une nouvelle invitation.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setInvitation({
        pharmacy_name: (invitationData.pharmacies as any).name,
        role: invitationData.role,
        email: invitationData.email,
        token: invitationData.token,
      });

      setFormData(prev => ({ ...prev, email: invitationData.email }));
    } catch (error: any) {
      console.error('Error loading invitation:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du chargement de l'invitation.",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Create user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/pharmacy-dashboard`,
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      toast({
        title: "Compte créé",
        description: "Votre compte a été créé avec succès. Vous allez être redirigé...",
      });

      // Wait a moment for the user to be fully created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Process the invitation
      const { error: processError } = await supabase.functions.invoke('process-pharmacy-invitation', {
        body: {
          token: invitation.token,
          userId: authData.user.id,
        },
      });

      if (processError) {
        console.error('Error processing invitation:', processError);
      }

      navigate('/pharmacy-dashboard');
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la création du compte.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Invitation à rejoindre une pharmacie</CardTitle>
          <CardDescription>
            Vous avez été invité à rejoindre <strong>{invitation.pharmacy_name}</strong> en tant que <strong>{getRoleLabel(invitation.role)}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Création du compte..." : "Créer mon compte et rejoindre"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              En créant un compte, vous acceptez de rejoindre {invitation.pharmacy_name}
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PharmacyInvitation;
