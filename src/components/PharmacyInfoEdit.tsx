import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Pencil } from "lucide-react";
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
  const [formData, setFormData] = useState({
    name: pharmacyData.name || '',
    phone: pharmacyData.phone || '',
    address: pharmacyData.address || '',
    city: pharmacyData.city || '',
    postal_code: pharmacyData.postal_code || '',
    notification_email: pharmacyData.notification_email || ''
  });
  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const {
        data,
        error
      } = await supabase.from('pharmacies').update(formData).eq('id', pharmacyId).select().single();
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
          updatedFields: Object.keys(formData)
        },
        entityType: 'pharmacy',
        entityId: pharmacyId
      });
      onUpdate(data);
      setEditDialogOpen(false);
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? "Mise à jour..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
};
export default PharmacyInfoEdit;