import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Bot, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductDialog } from "./ProductDialog";

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  onOptionSelect?: (option: string) => void;
}

interface ParsedQuestion {
  type: 'question';
  question: string;
  options: string[];
}

interface ParsedProducts {
  type: 'products';
  message: string;
  products: Array<{ 
    name: string; 
    reason: string;
    image_url?: string;
    average_price?: string;
  }>;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  image_url: string;
  description: string;
}

const ChatMessage = ({ role, content, onOptionSelect }: ChatMessageProps) => {
  const isUser = role === 'user';
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
    brand: string;
    price: number;
    description: string;
    imageUrl: string;
    reason?: string;
    source: 'arthur' | 'shop';
    productId?: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Essayer de parser le contenu comme JSON
  let parsedContent: ParsedQuestion | ParsedProducts | null = null;
  let textContent = content;

  try {
    // Chercher des blocs JSON dans le contenu
    const jsonMatch = content.match(/\{[\s\S]*"type"[\s\S]*\}/);
    if (jsonMatch) {
      parsedContent = JSON.parse(jsonMatch[0]);
      textContent = content.replace(jsonMatch[0], '').trim();
    }
  } catch (e) {
    // Ce n'est pas du JSON, on affiche le texte normalement
  }

  // Charger les produits si on a une réponse de type products
  const loadProducts = async (productRecommendations: Array<{ name: string; reason: string }>) => {
    setLoadingProducts(true);
    try {
      const productNames = productRecommendations.map(p => p.name);
      
      const { data } = await (supabase as any)
        .from('products')
        .select('id, name, brand, price, image_url, description')
        .in('name', productNames);
      
      // Créer un produit pour chaque recommandation, même si non trouvé en DB
      const productsWithReasons = productRecommendations.map(rec => {
        const dbProduct = data?.find((p: Product) => p.name === rec.name);
        return dbProduct || {
          id: `temp-${rec.name}`,
          name: rec.name,
          brand: 'À vérifier en pharmacie',
          price: 0,
          image_url: '',
          description: rec.reason
        };
      });
      
      setProducts(productsWithReasons);
      
      // Générer les images pour chaque produit
      productsWithReasons.forEach(async (product) => {
        try {
          const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-product-image', {
            body: { 
              productName: product.name,
              category: 'parapharmacie'
            }
          });
          
          if (!imageError && imageData?.imageUrl) {
            setGeneratedImages(prev => ({
              ...prev,
              [product.id]: imageData.imageUrl
            }));
          }
        } catch (err) {
          console.error('Error generating image for product:', product.id, err);
        }
      });
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Charger les produits au premier rendu si c'est une réponse products
  useEffect(() => {
    if (parsedContent?.type === 'products' && !isUser) {
      if (parsedContent.products.length > 0) {
        loadProducts(parsedContent.products);
      }
    }
  }, [content]);

  const handleOptionToggle = (option: string) => {
    const newSelected = new Set(selectedOptions);
    if (newSelected.has(option)) {
      newSelected.delete(option);
    } else {
      newSelected.add(option);
    }
    setSelectedOptions(newSelected);
  };

  const handleSubmitOptions = () => {
    if (onOptionSelect && selectedOptions.size > 0) {
      const selectedText = Array.from(selectedOptions).join(', ');
      onOptionSelect(selectedText);
    }
  };
  
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {!isUser && (
        <Avatar className="h-8 w-8 bg-gradient-primary border-2 border-primary/20">
          <AvatarFallback className="bg-transparent">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-[80%] space-y-3 ${isUser ? 'flex flex-col items-end' : ''}`}>
        {textContent && (
          <div
            className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-gradient-primary text-primary-foreground shadow-md'
                : 'bg-card border border-border shadow-sm'
            }`}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{textContent}</p>
          </div>
        )}

        {/* Questions avec options à cocher */}
        {parsedContent?.type === 'question' && !isUser && (
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium">{parsedContent.question}</p>
              <div className="space-y-2">
                {parsedContent.options.map((option, idx) => (
                  <Button
                    key={idx}
                    variant={selectedOptions.has(option) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleOptionToggle(option)}
                    className="w-full justify-start gap-2"
                  >
                    {selectedOptions.has(option) && <Check className="h-4 w-4" />}
                    {option}
                  </Button>
                ))}
              </div>
              {selectedOptions.size > 0 && (
                <Button
                  onClick={handleSubmitOptions}
                  className="w-full bg-gradient-primary"
                  size="sm"
                >
                  Valider ma sélection
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Produits recommandés */}
        {parsedContent?.type === 'products' && !isUser && (
          <div className="space-y-2">
            {parsedContent.message && (
              <p className="text-sm text-muted-foreground px-2">{parsedContent.message}</p>
            )}
            {loadingProducts ? (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid gap-2">
                {products.map((product, idx) => {
                  const recommendation = parsedContent.products[idx];
                  const isInDatabase = !product.id.startsWith('temp-');
                  const displayImage = recommendation?.image_url || product.image_url;
                  const displayPrice = recommendation?.average_price || (isInDatabase && product.price > 0 ? `${product.price.toFixed(2)}€` : null);
                  
                  return (
                    <Card 
                      key={product.id} 
                      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        setSelectedProduct({
                          id: product.id,
                          name: product.name,
                          brand: product.brand,
                          price: product.price,
                          description: product.description,
                          imageUrl: generatedImages[product.id] || displayImage || '/placeholder.svg',
                          reason: recommendation?.reason,
                          source: 'arthur',
                          productId: product.id
                        });
                        setDialogOpen(true);
                      }}
                    >
                      <CardContent className="p-3 flex gap-3">
                        <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                          {generatedImages[product.id] ? (
                            <img
                              src={generatedImages[product.id]}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{product.name}</h4>
                          <p className="text-xs text-muted-foreground">{product.brand}</p>
                          {displayPrice && (
                            <p className="text-lg font-bold text-primary mt-1">{displayPrice}</p>
                          )}
                          {recommendation?.reason && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              💡 {recommendation.reason}
                            </p>
                          )}
                          {!isInDatabase && (
                            <p className="text-xs text-amber-600 mt-1 font-medium">
                              ⚠️ Demandez conseil à votre pharmacien
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 bg-gradient-secondary border-2 border-secondary/20">
          <AvatarFallback className="bg-transparent">
            <User className="h-5 w-5 text-secondary-foreground" />
          </AvatarFallback>
        </Avatar>
      )}
      
      <ProductDialog 
        product={selectedProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default ChatMessage;
