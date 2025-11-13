import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePharmacyActivityLog } from "@/hooks/usePharmacyActivityLog";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const profileSchema = z.object({
  first_name: z.string().trim().min(1, { message: "Le prénom est requis" }).max(100),
  last_name: z.string().trim().min(1, { message: "Le nom est requis" }).max(100),
  phone: z.string().trim().min(10, { message: "Numéro de téléphone invalide" }).max(20),
  email: z.string().trim().email({ message: "Email invalide" }).max(255),
});

const PharmacyProfile = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { logActivity } = usePharmacyActivityLog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/pharmacy-login');
        return;
      }

      // Get pharmacy ID from user_roles
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('pharmacy_id')
        .eq('user_id', user.id)
        .single();

      if (roleData) {
        setPharmacyId(roleData.pharmacy_id);
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, email')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          email: data.email || user.email || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le profil.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      profileSchema.parse(profile);
    } catch (e: any) {
      toast({
        title: "Erreur de validation",
        description: e.errors[0]?.message || "Veuillez vérifier les informations saisies.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Non authentifié");
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name.trim(),
          last_name: profile.last_name.trim(),
          phone: profile.phone.trim(),
          email: profile.email.trim(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Log l'activité si pharmacyId existe
      if (pharmacyId) {
        await logActivity({
          pharmacyId,
          actionType: 'profile_update',
          actionDetails: {
            first_name: profile.first_name.trim(),
            last_name: profile.last_name.trim(),
            phone: profile.phone.trim(),
          },
        });
      }

      toast({
        title: "Succès",
        description: "Votre profil a été mis à jour avec succès.",
      });

      navigate('/pharmacy-dashboard');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Mon Profil</CardTitle>
            <CardDescription>
              Veuillez remplir vos informations personnelles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    placeholder="Votre prénom"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    placeholder="Votre nom"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="votre.email@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="0612345678"
                  required
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/pharmacy-dashboard')}
                  disabled={saving}
                >
                  Retour
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PharmacyProfile;
