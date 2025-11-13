import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePharmacyActivityLog } from "@/hooks/usePharmacyActivityLog";

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  image_url: string | null;
  stock_quantity: number;
  is_available: boolean;
  pharmacy_product_id: string;
}

interface PharmacyProductsListProps {
  pharmacyId: string;
}

export default function PharmacyProductsList({ pharmacyId }: PharmacyProductsListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [creatingPromotion, setCreatingPromotion] = useState(false);
  const { toast } = useToast();
  const { logActivity } = usePharmacyActivityLog();

  const [promotionForm, setPromotionForm] = useState({
    title: '',
    description: '',
    discount_percentage: 10,
    valid_until: '',
  });

  useEffect(() => {
    loadProducts();

    // Subscribe to realtime updates for pharmacy_products and products
    const channel = supabase
      .channel('pharmacy-products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pharmacy_products',
          filter: `pharmacy_id=eq.${pharmacyId}`,
        },
        () => {
          console.log('Pharmacy products changed, reloading...');
          loadProducts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        () => {
          console.log('Products changed, reloading...');
          loadProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pharmacyId]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('pharmacy_products')
        .select(`
          id,
          stock_quantity,
          is_available,
          products (
            id,
            name,
            brand,
            price,
            category,
            image_url
          )
        `)
        .eq('pharmacy_id', pharmacyId);

      if (error) throw error;

      const formattedProducts = data?.map((item: any) => ({
        id: item.products.id,
        name: item.products.name,
        brand: item.products.brand,
        price: item.products.price,
        category: item.products.category,
        image_url: item.products.image_url,
        stock_quantity: item.stock_quantity,
        is_available: item.is_available,
        pharmacy_product_id: item.id,
      })) || [];

      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openPromotionDialog = (product: Product) => {
    setSelectedProduct(product);
    setPromotionForm({
      title: `Promotion ${product.name}`,
      description: `${product.brand} - ${product.name}`,
      discount_percentage: 10,
      valid_until: '',
    });
    setPromotionDialogOpen(true);
  };

  const createPromotion = async () => {
    if (!selectedProduct) return;

    try {
      setCreatingPromotion(true);

      const originalPrice = selectedProduct.price;
      const validUntil = promotionForm.valid_until 
        ? new Date(promotionForm.valid_until).toISOString() 
        : null;

      const { error } = await supabase
        .from('promotions')
        .insert({
          pharmacy_id: pharmacyId,
          title: promotionForm.title,
          description: promotionForm.description,
          discount_percentage: promotionForm.discount_percentage,
          original_price: originalPrice,
          image_url: selectedProduct.image_url,
          valid_until: validUntil,
        });

      if (error) throw error;

      toast({
        title: "Promotion créée",
        description: "La promotion a été créée avec succès",
      });

      // Log l'activité
      await logActivity({
        pharmacyId,
        actionType: 'promotion_created',
        actionDetails: { title: promotionForm.title, productName: selectedProduct.name },
        entityType: 'promotion',
      });

      setPromotionDialogOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Error creating promotion:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la promotion",
        variant: "destructive",
      });
    } finally {
      setCreatingPromotion(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Aucun produit disponible</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
          >
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-32 object-cover rounded-md"
              />
            )}
            <div>
              <h3 className="font-semibold">{product.name}</h3>
              <p className="text-sm text-muted-foreground">{product.brand}</p>
              <Badge variant="outline" className="mt-1 text-xs">
                {product.category}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-bold text-primary">
                  {product.price.toFixed(2)} €
                </p>
                <p className="text-xs text-muted-foreground">
                  Stock: {product.stock_quantity}
                </p>
              </div>
              <Badge variant={product.is_available ? "default" : "secondary"}>
                {product.is_available ? "Disponible" : "Indisponible"}
              </Badge>
            </div>
            <Button
              onClick={() => openPromotionDialog(product)}
              variant="outline"
              className="w-full"
            >
              <Tag className="mr-2 h-4 w-4" />
              Créer une promotion
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Créer une promotion</DialogTitle>
            <DialogDescription>
              Créez une promotion pour {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre de la promotion</Label>
              <Input
                id="title"
                value={promotionForm.title}
                onChange={(e) =>
                  setPromotionForm({ ...promotionForm, title: e.target.value })
                }
                placeholder="Ex: Promotion sur le dentifrice"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={promotionForm.description}
                onChange={(e) =>
                  setPromotionForm({ ...promotionForm, description: e.target.value })
                }
                placeholder="Description de la promotion"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount">Pourcentage de réduction (%)</Label>
              <Input
                id="discount"
                type="number"
                min="1"
                max="100"
                value={promotionForm.discount_percentage}
                onChange={(e) =>
                  setPromotionForm({
                    ...promotionForm,
                    discount_percentage: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valid_until">Valide jusqu'au (optionnel)</Label>
              <Input
                id="valid_until"
                type="date"
                value={promotionForm.valid_until}
                onChange={(e) =>
                  setPromotionForm({ ...promotionForm, valid_until: e.target.value })
                }
              />
            </div>
            {selectedProduct && (
              <div className="bg-muted p-3 rounded-md space-y-1">
                <p className="text-sm">
                  <span className="font-semibold">Prix original:</span>{' '}
                  {selectedProduct.price.toFixed(2)} €
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Prix avec réduction:</span>{' '}
                  {(
                    selectedProduct.price *
                    (1 - promotionForm.discount_percentage / 100)
                  ).toFixed(2)}{' '}
                  €
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromotionDialogOpen(false)}
              disabled={creatingPromotion}
            >
              Annuler
            </Button>
            <Button onClick={createPromotion} disabled={creatingPromotion}>
              {creatingPromotion ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer la promotion'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
