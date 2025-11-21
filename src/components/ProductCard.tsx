import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    brand: string;
    category: string;
    price: number;
    description?: string;
    image_url?: string;
  };
  pharmacyId: string;
}

const ProductCard = ({ product, pharmacyId }: ProductCardProps) => {
  const { addToCart } = useCart();
  const { toast } = useToast();

  const handleAddToCart = async () => {
    try {
      await addToCart({
        id: product.id,
        productId: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        imageUrl: product.image_url || '',
        source: 'arthur',
        reason: 'Recommandé par Arthur'
      }, pharmacyId);

      toast({
        title: "✅ Ajouté au panier",
        description: `${product.name} (${product.brand})`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter au panier",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="overflow-hidden">
      {product.image_url && (
        <div className="w-full h-32 bg-muted flex items-center justify-center overflow-hidden">
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader className="pb-3">
        <CardTitle className="text-sm line-clamp-2">{product.name}</CardTitle>
        <CardDescription className="text-xs">{product.brand}</CardDescription>
      </CardHeader>
      {product.description && (
        <CardContent className="pb-3 pt-0">
          <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
        </CardContent>
      )}
      <CardFooter className="flex items-center justify-between pt-3 border-t">
        <div className="font-bold text-primary">{product.price.toFixed(2)} €</div>
        <Button 
          onClick={handleAddToCart}
          size="sm"
          className="h-8"
        >
          <ShoppingCart className="h-3 w-3 mr-1" />
          Ajouter
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
