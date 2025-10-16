import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Tag, ShoppingCart } from "lucide-react";
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

interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  valid_until: string;
  image_url?: string;
  original_price?: number;
}

interface PromotionSliderProps {
  promotions: Promotion[];
  onSelectPromotion: (promotion: Promotion) => void;
}

const PromotionSlider = ({ promotions, onSelectPromotion }: PromotionSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dialogIndex, setDialogIndex] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { addToCart } = useCart();

  // Auto-play: défilement toutes les 2 secondes (pause au survol et dans le popup)
  const intervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      promotions.length <= 1 ||
      isDialogOpen ||
      isHovered ||
      (typeof document !== 'undefined' && document.visibilityState !== 'visible')
    ) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promotions.length);
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [promotions.length, isDialogOpen, isHovered]);

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
    setCurrentIndex((prev) => (prev + 1) % promotions.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length);
  };

  const nextDialogSlide = () => {
    setDialogIndex((prev) => (prev + 1) % promotions.length);
  };

  const prevDialogSlide = () => {
    setDialogIndex((prev) => (prev - 1 + promotions.length) % promotions.length);
  };

  const handlePromotionClick = (index: number) => {
    setDialogIndex(index);
    setIsDialogOpen(true);
  };

  const handleAddToCart = () => {
    const selectedPromotion = promotions[dialogIndex];
    if (selectedPromotion) {
      const discountedPrice = selectedPromotion.original_price 
        ? selectedPromotion.original_price * (1 - selectedPromotion.discount_percentage / 100)
        : 0;
      
      addToCart({
        id: selectedPromotion.id,
        name: selectedPromotion.title,
        price: discountedPrice,
        source: 'shop',
        imageUrl: selectedPromotion.image_url || '',
        brand: 'Promotion'
      });
      
      toast.success("Promotion ajoutée au panier !");
      setIsDialogOpen(false);
    }
  };

  if (promotions.length === 0) {
    return null;
  }

  const currentPromo = promotions[currentIndex];

  return (
    <>
      <div className="w-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className="container max-w-3xl mx-auto relative">
          <Card 
            className="cursor-pointer hover:shadow-xl transition-all duration-300 overflow-hidden border-2 border-primary/20 hover:border-primary/40"
            onClick={() => handlePromotionClick(currentIndex)}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-3">
                {currentPromo.image_url && (
                  <div className="relative h-16 w-16 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden bg-muted rounded-md">
                    <img
                      src={currentPromo.image_url}
                      alt={currentPromo.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
                    <Badge className="absolute top-1 right-1 bg-gradient-primary text-primary-foreground border-0 shadow-lg text-xs px-1.5 py-0.5">
                      -{currentPromo.discount_percentage}%
                    </Badge>
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-2 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Tag className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                    <h3 className="font-bold text-sm sm:text-base text-foreground truncate">{currentPromo.title}</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mb-2">{currentPromo.description}</p>
                  {currentPromo.original_price && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground line-through">{currentPromo.original_price.toFixed(2)}€</span>
                      <span className="text-base sm:text-lg font-bold text-primary">
                        {(currentPromo.original_price * (1 - currentPromo.discount_percentage / 100)).toFixed(2)}€
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {promotions.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {promotions.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {promotions.map((_, index) => (
                <button
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
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
              <Tag className="h-5 w-5 text-primary" />
              {promotions[dialogIndex]?.title}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {promotions[dialogIndex]?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 relative">
            {promotions[dialogIndex]?.image_url && (
              <div className="relative h-64 w-full rounded-lg overflow-hidden bg-muted">
                <img
                  src={promotions[dialogIndex].image_url}
                  alt={promotions[dialogIndex].title}
                  className="h-full w-full object-cover"
                />
                <Badge className="absolute top-3 right-3 bg-gradient-primary text-primary-foreground border-0 shadow-lg text-lg px-3 py-1">
                  -{promotions[dialogIndex].discount_percentage}%
                </Badge>
              </div>
            )}
            
            {promotions[dialogIndex]?.original_price && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Prix original</p>
                  <p className="text-xl font-semibold line-through">{promotions[dialogIndex].original_price.toFixed(2)}€</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground">Prix promotionnel</p>
                  <p className="text-3xl font-bold text-primary">
                    {(promotions[dialogIndex].original_price * (1 - promotions[dialogIndex].discount_percentage / 100)).toFixed(2)}€
                  </p>
                </div>
              </div>
            )}
            
            {promotions[dialogIndex]?.valid_until && (
              <p className="text-xs text-muted-foreground text-center">
                Valable jusqu'au {new Date(promotions[dialogIndex].valid_until).toLocaleDateString('fr-FR')}
              </p>
            )}
            
            <Button 
              onClick={handleAddToCart}
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Ajouter au panier
            </Button>

            {/* Navigation du slider dans le dialog */}
            {promotions.length > 1 && (
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
          {promotions.length > 1 && (
            <div className="flex justify-center gap-2 pb-2">
              {promotions.map((_, index) => (
                <button
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === dialogIndex ? 'w-8 bg-primary' : 'w-2 bg-muted'
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

export default PromotionSlider;
