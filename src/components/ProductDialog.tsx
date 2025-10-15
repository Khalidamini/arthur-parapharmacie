import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Check } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  description: string;
  imageUrl: string;
  reason?: string;
  source?: 'arthur' | 'shop';
  productId?: string;
}

interface ProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProductDialog = ({ product, open, onOpenChange }: ProductDialogProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart } = useCart();
  const { toast } = useToast();

  if (!product) return null;

  const handleAddToCart = async () => {
    setIsAdding(true);
    await addToCart({
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      imageUrl: product.imageUrl,
      source: product.source || 'arthur',
      reason: product.reason,
      productId: product.productId || product.id,
    });
    
    toast({
      title: "Produit ajouté",
      description: `${product.name} a été ajouté à votre panier`,
    });
    
    setTimeout(() => {
      setIsAdding(false);
      onOpenChange(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="aspect-square w-full max-w-md mx-auto rounded-lg overflow-hidden bg-muted">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Marque</p>
              <p className="font-semibold">{product.brand}</p>
            </div>

            {product.price > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Prix</p>
                <p className="text-3xl font-bold text-primary">{product.price.toFixed(2)}€</p>
              </div>
            )}

            {product.reason && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Pourquoi Arthur vous le recommande</p>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">💡 {product.reason}</p>
                </div>
              </div>
            )}

            {product.description && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <p className="text-sm leading-relaxed">{product.description}</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleAddToCart}
            className="w-full bg-gradient-primary text-lg py-6"
            disabled={isAdding}
          >
            {isAdding ? (
              <>
                <Check className="mr-2 h-5 w-5" />
                Ajouté au panier
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-5 w-5" />
                Ajouter au panier
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
