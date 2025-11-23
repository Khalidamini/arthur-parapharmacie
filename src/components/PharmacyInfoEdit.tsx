import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Upload, X } from "lucide-react";
import { usePharmacyActivityLog } from "@/hooks/usePharmacyActivityLog";
interface PharmacyInfoEditProps {
  pharmacyData: any;
  pharmacyId: string;
  onUpdate: (updatedData: any) => void;
}
const PharmacyInfoEdit = ({
  pharmacyData,
  pharmacyId,
  onUpdate
}: PharmacyInfoEditProps) => {
  const {
    toast
  } = useToast();
  const {
    logActivity
  } = usePharmacyActivityLog();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formData, setFormData] = useState({
    name: pharmacyData.name || '',
    phone: pharmacyData.phone || '',
    address: pharmacyData.address || '',
    city: pharmacyData.city || '',
    postal_code: pharmacyData.postal_code || '',
    notification_email: pharmacyData.notification_email || ''
  });
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "Le logo ne doit pas dépasser 2 Mo.",
          variant: "destructive"
        });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Format invalide",
          description: "Veuillez sélectionner une image.",
          variant: "destructive"
        });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setUploadingLogo(true);
      
      // Supprimer le logo du storage si il existe
      if (pharmacyData.logo_url) {
        const logoPath = pharmacyData.logo_url.split('/').pop();
        await supabase.storage
          .from('pharmacy-logos')
          .remove([`${pharmacyId}/${logoPath}`]);
      }

      // Mettre à jour la base de données
      const { data, error } = await supabase
        .from('pharmacies')
        .update({ logo_url: null })
        .eq('id', pharmacyId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Logo supprimé",
        description: "Le logo de votre pharmacie a été supprimé."
      });

      await logActivity({
        pharmacyId,
        actionType: 'pharmacy_logo_removed',
        entityType: 'pharmacy',
        entityId: pharmacyId
      });

      onUpdate(data);
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le logo.",
        variant: "destructive"
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile) return null;

    try {
      setUploadingLogo(true);

      // Supprimer l'ancien logo si il existe
      if (pharmacyData.logo_url) {
        const oldLogoPath = pharmacyData.logo_url.split('/').pop();
        await supabase.storage
          .from('pharmacy-logos')
          .remove([`${pharmacyId}/${oldLogoPath}`]);
      }

      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${pharmacyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('pharmacy-logos')
        .upload(filePath, logoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pharmacy-logos')
        .getPublicUrl(filePath);

      await logActivity({
        pharmacyId,
        actionType: 'pharmacy_logo_uploaded',
        entityType: 'pharmacy',
        entityId: pharmacyId
      });

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      let logoUrl = pharmacyData.logo_url;

      // Upload du logo si un nouveau fichier a été sélectionné
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      const updateData = logoUrl ? { ...formData, logo_url: logoUrl } : formData;

      const {
        data,
        error
      } = await supabase.from('pharmacies').update(updateData).eq('id', pharmacyId).select().single();
      if (error) throw error;
      toast({
        title: "Informations mises à jour",
        description: "Les informations de votre pharmacie ont été mises à jour avec succès."
      });

      // Log l'activité
      await logActivity({
        pharmacyId,
        actionType: 'pharmacy_info_updated',
        actionDetails: {
          updatedFields: Object.keys(updateData)
        },
        entityType: 'pharmacy',
        entityId: pharmacyId
      });
      onUpdate(data);
      setEditDialogOpen(false);
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error: any) {
      console.error('Error updating pharmacy:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la mise à jour.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };
  const openEditDialog = () => {
    setFormData({
      name: pharmacyData.name || '',
      phone: pharmacyData.phone || '',
      address: pharmacyData.address || '',
      city: pharmacyData.city || '',
      postal_code: pharmacyData.postal_code || '',
      notification_email: pharmacyData.notification_email || ''
    });
    setLogoFile(null);
    setLogoPreview(null);
    setEditDialogOpen(true);
  };
  return <>
      <Card>
        <CardHeader>
          <CardTitle>Informations de l'établissement</CardTitle>
          <CardDescription>
            Gérez les informations de votre pharmacie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pharmacyData.logo_url && (
            <div className="flex items-center gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
              <img 
                src={pharmacyData.logo_url} 
                alt="Logo pharmacie" 
                className="h-16 w-16 object-contain rounded"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Logo actuel</p>
                <p className="text-xs text-muted-foreground">Visible sur toutes les pages</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveLogo}
                disabled={uploadingLogo}
              >
                <X className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </div>
          )}
          
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
              <p className="text-sm text-muted-foreground">Email de notification et de connexion   </p>
              <p className="font-medium">{pharmacyData.notification_email || 'Non renseigné'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Code QR</p>
              <p className="font-mono font-medium">{pharmacyData.qr_code}</p>
            </div>
          </div>
          <Button className="mt-4" onClick={openEditDialog}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier les informations
          </Button>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier les informations</DialogTitle>
            <DialogDescription>
              Modifiez les informations de votre pharmacie
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="logo">Logo de la pharmacie</Label>
              <div className="flex items-center gap-4">
                {(logoPreview || pharmacyData.logo_url) && (
                  <img 
                    src={logoPreview || pharmacyData.logo_url} 
                    alt="Logo preview" 
                    className="h-16 w-16 object-contain rounded border"
                  />
                )}
                <div className="flex-1">
                  <Input 
                    id="logo" 
                    type="file" 
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: JPG, PNG. Taille max: 2 Mo
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Nom de la pharmacie</Label>
              <Input id="name" value={formData.name} onChange={e => setFormData({
              ...formData,
              name: e.target.value
            })} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" type="tel" value={formData.phone} onChange={e => setFormData({
              ...formData,
              phone: e.target.value
            })} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notification_email">Email de notification</Label>
              <Input id="notification_email" type="email" placeholder="email@pharmacie.fr" value={formData.notification_email} onChange={e => setFormData({
              ...formData,
              notification_email: e.target.value
            })} />
              <p className="text-sm text-muted-foreground">
                Cet email sera utilisé pour recevoir les notifications de nouvelles commandes
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Adresse</Label>
              <Input id="address" value={formData.address} onChange={e => setFormData({
              ...formData,
              address: e.target.value
            })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="postal_code">Code postal</Label>
                <Input id="postal_code" value={formData.postal_code} onChange={e => setFormData({
                ...formData,
                postal_code: e.target.value
              })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" value={formData.city} onChange={e => setFormData({
                ...formData,
                city: e.target.value
              })} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditDialogOpen(false);
                setLogoFile(null);
                setLogoPreview(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={updating || uploadingLogo}>
              {updating || uploadingLogo ? "Mise à jour..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
};
export default PharmacyInfoEdit;