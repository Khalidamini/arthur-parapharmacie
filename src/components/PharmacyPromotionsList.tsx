import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Loader2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discount_percentage: number | null;
  original_price: number | null;
  image_url: string | null;
  valid_until: string | null;
  created_at: string;
}

interface PharmacyPromotionsListProps {
  pharmacyId: string;
}

export default function PharmacyPromotionsList({ pharmacyId }: PharmacyPromotionsListProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPromotions();

    // Subscribe to realtime updates for promotions
    const channel = supabase
      .channel('promotions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promotions',
          filter: `pharmacy_id=eq.${pharmacyId}`,
        },
        () => {
          console.log('Promotions changed, reloading...');
          loadPromotions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pharmacyId]);

  const loadPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('pharmacy_id', pharmacyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('Error loading promotions:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les promotions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (promotionId: string) => {
    setPromotionToDelete(promotionId);
    setDeleteDialogOpen(true);
  };

  const deletePromotion = async () => {
    if (!promotionToDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promotionToDelete);

      if (error) throw error;

      toast({
        title: "Promotion supprimée",
        description: "La promotion a été supprimée avec succès",
      });

      loadPromotions();
    } catch (error) {
      console.error('Error deleting promotion:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la promotion",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setPromotionToDelete(null);
    }
  };

  const calculateDiscountedPrice = (originalPrice: number | null, discount: number | null) => {
    if (!originalPrice || !discount) return null;
    return originalPrice * (1 - discount / 100);
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (promotions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Aucune promotion active</p>
        <p className="text-sm text-muted-foreground mt-2">
          Créez des promotions depuis l'onglet Produits
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {promotions.map((promotion) => {
          const discountedPrice = calculateDiscountedPrice(
            promotion.original_price,
            promotion.discount_percentage
          );
          const expired = isExpired(promotion.valid_until);

          return (
            <div
              key={promotion.id}
              className={`border rounded-lg p-4 space-y-3 ${
                expired ? 'opacity-60' : ''
              }`}
            >
              {promotion.image_url && (
                <img
                  src={promotion.image_url}
                  alt={promotion.title}
                  className="w-full h-32 object-cover rounded-md"
                />
              )}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{promotion.title}</h3>
                  {expired && (
                    <Badge variant="destructive" className="text-xs">
                      Expirée
                    </Badge>
                  )}
                </div>
                {promotion.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {promotion.description}
                  </p>
                )}
              </div>
              {promotion.discount_percentage && (
                <Badge variant="secondary" className="text-lg font-bold">
                  -{promotion.discount_percentage}%
                </Badge>
              )}
              {promotion.original_price && discountedPrice && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground line-through">
                    {promotion.original_price.toFixed(2)} €
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {discountedPrice.toFixed(2)} €
                  </p>
                </div>
              )}
              {promotion.valid_until && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Valide jusqu'au{' '}
                    {new Date(promotion.valid_until).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => openDeleteDialog(promotion.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            </div>
          );
        })}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la promotion</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette promotion ? Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deletePromotion} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
