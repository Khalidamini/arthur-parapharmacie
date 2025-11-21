import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Star, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

interface FeaturedProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  image_url: string | null;
  description: string | null;
}

interface FeaturedProductsSliderProps {
  products: FeaturedProduct[];
}

const FeaturedProductsSlider = ({ products }: FeaturedProductsSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dialogIndex, setDialogIndex] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { addToCart, selectedPharmacyId } = useCart();

  // Auto-play: défilement toutes les 3 secondes (pause au survol et dans le popup)
  const intervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      products.length <= 1 ||
      isDialogOpen ||
      isHovered ||
      (typeof document !== 'undefined' && document.visibilityState !== 'visible')
    ) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % products.length);
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [products.length, isDialogOpen, isHovered]);

  // Reprendre/arrêter au changement de visibilité onglet
  useEffect(() => {
    const onVisibility = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % products.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + products.length) % products.length);
  };

  const nextDialogSlide = () => {
    setDialogIndex((prev) => (prev + 1) % products.length);
  };

  const prevDialogSlide = () => {
    setDialogIndex((prev) => (prev - 1 + products.length) % products.length);
  };

  const handleProductClick = (index: number) => {
    setDialogIndex(index);
    setIsDialogOpen(true);
  };

  const handleAddToCart = async () => {
    const selectedProduct = products[dialogIndex];
    if (selectedProduct) {
      try {
        await addToCart({
          id: selectedProduct.id,
          name: selectedProduct.name,
          brand: selectedProduct.brand,
          price: selectedProduct.price,
          imageUrl: selectedProduct.image_url || '',
          source: 'shop',
          productId: selectedProduct.id,
        }, selectedPharmacyId || undefined);
        
        toast.success("Produit ajouté au panier !");
        setIsDialogOpen(false);
      } catch (error) {
        toast.error("Erreur lors de l'ajout au panier");
      }
    }
  };

  if (products.length === 0) {
    return null;
  }

  const currentProduct = products[currentIndex];

  return (
    <>
      <div className="w-full overflow-hidden" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className="w-full relative">
          <Card 
            className="cursor-pointer hover:shadow-xl transition-all duration-300 overflow-hidden border-2 border-primary/20 hover:border-primary/40 bg-gradient-to-br from-background to-primary/5"
            onClick={() => handleProductClick(currentIndex)}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-3 w-full">
                {currentProduct.image_url && (
                  <div className="relative h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 flex-shrink-0 overflow-hidden bg-muted rounded-md">
                    <img
                      src={currentProduct.image_url}
                      alt={currentProduct.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
                    <Badge className="absolute top-0.5 right-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 shadow-lg text-[9px] sm:text-[10px] md:text-xs px-0.5 sm:px-1 py-0.5">
                      <Star className="h-2 w-2 sm:h-2.5 sm:w-2.5 inline mr-0.5" fill="white" />
                      Coup de cœur
                    </Badge>
                  </div>
                )}
                <div className="flex-1 min-w-0 overflow-hidden py-0.5 sm:py-1">
                  <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5">
                    <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-500 flex-shrink-0 fill-amber-500" />
                    <h3 className="font-bold text-[11px] sm:text-xs md:text-sm text-foreground truncate">{currentProduct.name}</h3>
                  </div>
                  <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground line-clamp-1 mb-0.5 sm:mb-1">{currentProduct.brand}</p>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0">{currentProduct.category}</Badge>
                    <span className="text-xs sm:text-sm md:text-base font-bold text-primary whitespace-nowrap">
                      {currentProduct.price.toFixed(2)}€
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {products.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-0.5 sm:left-1 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
              >
                <ChevronLeft className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0.5 sm:right-1 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
              >
                <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4" />
              </Button>
            </>
          )}

          {products.length > 1 && (
            <div className="flex justify-center gap-0.5 sm:gap-1 mt-1 sm:mt-1.5">
              {products.map((_, index) => (
                <button
                  key={index}
                  className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${
                    index === currentIndex ? 'w-3 sm:w-4 md:w-6 bg-amber-500' : 'w-1 sm:w-1.5 bg-muted'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(index);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              {products[dialogIndex]?.name}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {products[dialogIndex]?.brand} - {products[dialogIndex]?.category}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 relative">
            {products[dialogIndex]?.image_url && (
              <div className="relative h-64 w-full rounded-lg overflow-hidden bg-muted">
                <img
                  src={products[dialogIndex].image_url}
                  alt={products[dialogIndex].name}
                  className="h-full w-full object-cover"
                />
                <Badge className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 shadow-lg text-lg px-3 py-1">
                  <Star className="h-4 w-4 inline mr-1" fill="white" />
                  Coup de cœur
                </Badge>
              </div>
            )}
            
            {products[dialogIndex]?.description && (
              <p className="text-sm text-muted-foreground">{products[dialogIndex].description}</p>
            )}
            
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Prix</p>
                <p className="text-3xl font-bold text-primary">
                  {products[dialogIndex]?.price.toFixed(2)}€
                </p>
              </div>
              <Badge variant="outline" className="text-sm px-3 py-1">
                {products[dialogIndex]?.category}
              </Badge>
            </div>
            
            <Button 
              onClick={handleAddToCart}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Ajouter au panier
            </Button>

            {/* Navigation du slider dans le dialog */}
            {products.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-32 h-10 w-10 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevDialogSlide();
                  }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-32 h-10 w-10 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextDialogSlide();
                  }}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
          
          {/* Indicateurs de position */}
          {products.length > 1 && (
            <div className="flex justify-center gap-2 pb-2">
              {products.map((_, index) => (
                <button
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === dialogIndex ? 'w-8 bg-amber-500' : 'w-2 bg-muted'
                  }`}
                  onClick={() => setDialogIndex(index)}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeaturedProductsSlider;
