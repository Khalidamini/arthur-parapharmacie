import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);

  // Auto-play: défiler toutes les 2 secondes
  useEffect(() => {
    if (promotions.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promotions.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [promotions.length]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % promotions.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length);
  };

  const handlePromotionClick = (promo: Promotion) => {
    setSelectedPromotion(promo);
  };

  const handleSelectPromotion = () => {
    if (selectedPromotion) {
      onSelectPromotion(selectedPromotion);
      setSelectedPromotion(null);
    }
  };

  if (promotions.length === 0) {
    return null;
  }

  const currentPromo = promotions[currentIndex];

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border shadow-md">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <Card 
            className="cursor-pointer hover:shadow-xl transition-all duration-300 overflow-hidden border-2 border-primary/20 hover:border-primary/40"
            onClick={() => handlePromotionClick(currentPromo)}
          >
            <CardContent className="p-0">
              <div className="flex items-center gap-4">
                {currentPromo.image_url && (
                  <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden bg-muted">
                    <img
                      src={currentPromo.image_url}
                      alt={currentPromo.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
                    <Badge className="absolute top-2 right-2 bg-gradient-primary text-primary-foreground border-0 shadow-lg text-sm px-2.5 py-1">
                      -{currentPromo.discount_percentage}%
                    </Badge>
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-5 w-5 text-primary flex-shrink-0" />
                    <h3 className="font-bold text-lg text-foreground truncate">{currentPromo.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{currentPromo.description}</p>
                  {currentPromo.original_price && (
                    <div className="flex items-center gap-3">
                      <span className="text-base text-muted-foreground line-through">{currentPromo.original_price.toFixed(2)}€</span>
                      <span className="text-2xl font-bold text-primary">
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
                className="absolute left-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {promotions.length > 1 && (
            <div className="flex justify-center gap-2 mt-3">
              {promotions.map((_, index) => (
                <button
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentIndex ? 'w-8 bg-primary' : 'w-1.5 bg-muted'
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

      <Dialog open={!!selectedPromotion} onOpenChange={() => setSelectedPromotion(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              {selectedPromotion?.title}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {selectedPromotion?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPromotion?.image_url && (
              <div className="relative h-48 w-full rounded-lg overflow-hidden bg-muted">
                <img
                  src={selectedPromotion.image_url}
                  alt={selectedPromotion.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
              <span className="text-sm font-medium text-accent-foreground">Réduction</span>
              <Badge className="bg-gradient-primary text-primary-foreground border-0">
                -{selectedPromotion?.discount_percentage}%
              </Badge>
            </div>
            {selectedPromotion?.original_price && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Prix original</p>
                  <p className="text-lg font-semibold line-through">{selectedPromotion.original_price.toFixed(2)}€</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground">Prix promotionnel</p>
                  <p className="text-2xl font-bold text-primary">
                    {(selectedPromotion.original_price * (1 - selectedPromotion.discount_percentage / 100)).toFixed(2)}€
                  </p>
                </div>
              </div>
            )}
            {selectedPromotion?.valid_until && (
              <p className="text-xs text-muted-foreground text-center">
                Valable jusqu'au {new Date(selectedPromotion.valid_until).toLocaleDateString('fr-FR')}
              </p>
            )}
            <Button 
              onClick={handleSelectPromotion}
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              Ajouter à mes recommandations
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PromotionSlider;
