import { useState } from 'react';
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
}

interface PromotionSliderProps {
  promotions: Promotion[];
  onSelectPromotion: (promotion: Promotion) => void;
}

const PromotionSlider = ({ promotions, onSelectPromotion }: PromotionSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);

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
      <div className="relative mb-6">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden border-2 border-primary/10 hover:border-primary/30"
          onClick={() => handlePromotionClick(currentPromo)}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-primary opacity-10 rounded-bl-full"></div>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">{currentPromo.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{currentPromo.description}</p>
              </div>
              <Badge className="bg-gradient-primary text-primary-foreground border-0 shadow-sm ml-3">
                -{currentPromo.discount_percentage}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {promotions.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background shadow-md"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background shadow-md"
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
          <div className="flex justify-center gap-1.5 mt-3">
            {promotions.map((_, index) => (
              <button
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
                }`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        )}
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
            <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
              <span className="text-sm font-medium text-accent-foreground">Réduction</span>
              <Badge className="bg-gradient-primary text-primary-foreground border-0">
                -{selectedPromotion?.discount_percentage}%
              </Badge>
            </div>
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
