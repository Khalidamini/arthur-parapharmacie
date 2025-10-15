import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Bot, Check } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  products: Array<{ name: string; reason: string }>;
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
  const loadProducts = async (productNames: string[]) => {
    setLoadingProducts(true);
    try {
      const { data } = await (supabase as any)
        .from('products')
        .select('id, name, brand, price, image_url, description')
        .in('name', productNames);
      
      if (data) {
        setProducts(data);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Charger les produits au premier rendu si c'est une réponse products
  useState(() => {
    if (parsedContent?.type === 'products' && !isUser) {
      const productNames = parsedContent.products.map(p => p.name);
      if (productNames.length > 0) {
        loadProducts(productNames);
      }
    }
  });

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
                {products.map((product) => {
                  const productReason = parsedContent.products.find(p => p.name === product.name)?.reason;
                  return (
                    <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-3 flex gap-3">
                        <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                              Pas d'image
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{product.name}</h4>
                          <p className="text-xs text-muted-foreground">{product.brand}</p>
                          <p className="text-lg font-bold text-primary mt-1">{product.price.toFixed(2)}€</p>
                          {productReason && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{productReason}</p>
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
    </div>
  );
};

export default ChatMessage;
