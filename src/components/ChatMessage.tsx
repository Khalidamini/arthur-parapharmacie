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
    id: string;
    name: string;
    brand: string;
    price: number;
    reason: string;
    image_url?: string;
    category?: string;
    available_in_pharmacy?: boolean;
  }>;
}

interface ParsedSalesAdvice {
  type: 'sales_advice';
  message: string;
  main_products?: Array<{
    name: string;
    price?: string;
    selling_points?: string[];
    customer_benefit?: string;
    how_to_present?: string;
  }>;
  additional_sales?: Array<{
    name: string;
    price?: string;
    reason?: string;
    upsell_technique?: string;
    added_value?: string;
  }>;
  total_basket?: string;
  closing_tips?: string[];
}

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  image_url: string;
  description: string;
  category?: string;
  available_in_pharmacy?: boolean;
}

const ChatMessage = ({ role, content, onOptionSelect }: ChatMessageProps) => {
  const isUser = role === 'user';
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
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
  let parsedContent: ParsedQuestion | ParsedProducts | ParsedSalesAdvice | { type: 'message'; message: string } | null = null;
  let textContent = content;

  try {
    // Vérifier si content est déjà un objet
    if (typeof content === 'object' && content !== null && 'type' in (content as any)) {
      parsedContent = content as any;
      if (parsedContent.type === 'message' && 'message' in (parsedContent as any)) {
        textContent = (parsedContent as any).message;
      }
    } else if (typeof content === 'string' && content) {
      // Chercher des blocs JSON dans le contenu string
      const jsonMatch = content.match(/\{[\s\S]*?"type"[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          parsedContent = parsed;
          
          // Extraire le message et convertir les \n en vrais sauts de ligne
          if (parsed.type === 'message' && parsed.message) {
            textContent = parsed.message.replace(/\\n/g, '\n');
          } else if (parsed.type === 'products' && parsed.message) {
            textContent = parsed.message.replace(/\\n/g, '\n');
          } else if (parsed.type === 'sales_advice' && parsed.message) {
            textContent = parsed.message.replace(/\\n/g, '\n');
          } else {
            textContent = content.replace(jsonMatch[0], '').trim();
          }
        }
      } else {
        // Pas de JSON trouvé, c'est un message texte simple
        textContent = content;
      }
    }
  } catch (e) {
    // En cas d'erreur de parsing, on affiche le texte normalement
    console.error('Error parsing message content:', e);
    textContent = typeof content === 'string' ? content : JSON.stringify(content);
  }

  // Générer une URL d'image gratuite via Unsplash Source
  const generateFreeImageUrl = (productName: string): string => {
    // Nettoyer le nom du produit pour la recherche
    const searchTerm = productName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, ',');
    
    // Utiliser Unsplash Source (gratuit, sans API key)
    return `https://source.unsplash.com/800x600/?${searchTerm},product,health`;
  };

  // Charger les produits si on a une réponse de type products
  const loadProducts = async (productRecommendations: Array<{ 
    id: string; 
    name: string; 
    brand: string;
    price: number;
    reason: string;
    image_url?: string;
    category?: string;
    available_in_pharmacy?: boolean;
  }>) => {
    setLoadingProducts(true);
    try {
      const proxyBase = import.meta.env.VITE_SUPABASE_URL;
      
      // Utiliser directement les produits fournis par Arthur avec leurs IDs
      const productsWithProxy = productRecommendations.map(rec => {
        const rawImage = rec.image_url;
        const isExternal = rawImage?.startsWith('http');
        const displayImage = isExternal && proxyBase
          ? `${proxyBase}/functions/v1/image-proxy?url=${encodeURIComponent(rawImage)}`
          : (rawImage || '/placeholder.svg');
        
        return {
          id: rec.id,
          name: rec.name,
          brand: rec.brand,
          price: rec.price,
          image_url: displayImage,
          description: rec.reason,
          category: rec.category,
          available_in_pharmacy: rec.available_in_pharmacy
        };
      });
      
      setProducts(productsWithProxy);
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
        {/* Bulle de texte principale uniquement pour les messages simples */}
        {textContent && (!parsedContent || parsedContent.type === 'message') && (
          <div
            className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-gradient-primary text-primary-foreground shadow-md'
                : 'bg-card border border-border shadow-sm'
            }`}
          >
            {(() => {
              const paragraphs = (!isUser ? textContent : textContent.trim()).split(/\n+/).filter(Boolean);
              return paragraphs.map((para, idx) => (
                <p
                  key={idx}
                  className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    !isUser && idx < paragraphs.length - 1 ? 'mb-3' : ''
                  }`}
                >
                  {para.trim()}
                </p>
              ));
            })()}
          </div>
        )}


        {/* Questions avec options à cocher */}
        {parsedContent?.type === 'question' && !isUser && parsedContent.question && Array.isArray(parsedContent.options) && (
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
                    className="w-full justify-start gap-2 h-auto min-h-[2.5rem] whitespace-normal text-left py-2"
                  >
                    {selectedOptions.has(option) && <Check className="h-4 w-4 flex-shrink-0" />}
                    <span className="flex-1">{typeof option === 'string' ? option : JSON.stringify(option)}</span>
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

        {/* Conseils de vente pour le personnel de pharmacie */}
        {parsedContent?.type === 'sales_advice' && !isUser && (
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardContent className="pt-4 space-y-4">
              {parsedContent.message && (
                <p className="text-sm font-medium text-foreground">{parsedContent.message}</p>
              )}
              
              {parsedContent.main_products && parsedContent.main_products.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-primary">🎯 Produits principaux à proposer</h4>
                  {parsedContent.main_products.map((product, idx) => (
                    <div key={idx} className="bg-card/80 backdrop-blur-sm rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <h5 className="font-semibold text-sm">{product.name}</h5>
                        {product.price && <span className="text-sm font-bold text-primary">{product.price}</span>}
                      </div>
                      
                      {product.customer_benefit && (
                        <p className="text-xs text-muted-foreground">
                          <strong>✨ Bénéfice client :</strong> {product.customer_benefit}
                        </p>
                      )}
                      
                      {product.selling_points && product.selling_points.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">💬 Arguments de vente :</p>
                          <ul className="space-y-1">
                            {product.selling_points.map((point, pidx) => (
                              <li key={pidx} className="text-xs text-muted-foreground pl-4">• {point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {product.how_to_present && (
                        <p className="text-xs text-primary/80 bg-primary/5 rounded p-2">
                          <strong>🎤 Comment présenter :</strong> "{product.how_to_present}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {parsedContent.additional_sales && parsedContent.additional_sales.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-accent">💰 Ventes additionnelles suggérées</h4>
                  {parsedContent.additional_sales.map((product, idx) => (
                    <div key={idx} className="bg-card/80 backdrop-blur-sm rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <h5 className="font-semibold text-sm">{product.name}</h5>
                        {product.price && <span className="text-sm font-bold text-accent">{product.price}</span>}
                      </div>
                      
                      {product.reason && (
                        <p className="text-xs text-muted-foreground">
                          <strong>📌 Pourquoi :</strong> {product.reason}
                        </p>
                      )}
                      
                      {product.upsell_technique && (
                        <p className="text-xs text-primary/80 bg-primary/5 rounded p-2">
                          <strong>🎤 Comment présenter :</strong> "{product.upsell_technique}"
                        </p>
                      )}
                      
                      {product.added_value && (
                        <p className="text-xs text-accent font-semibold">
                          💵 Valeur ajoutée : {product.added_value}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {parsedContent.total_basket && (
                <div className="bg-primary/10 rounded-lg p-3">
                  <p className="text-sm font-semibold text-primary">
                    🛒 Panier total estimé : {parsedContent.total_basket}
                  </p>
                </div>
              )}
              
              {parsedContent.closing_tips && parsedContent.closing_tips.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-accent">✅ Conseils de closing</h4>
                  <ul className="space-y-1">
                    {parsedContent.closing_tips.map((tip, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground pl-4">• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Produits recommandés */}
        {parsedContent?.type === 'products' && !isUser && (
          <div className="space-y-2">
            {parsedContent.message && (
              <p className="text-sm text-muted-foreground px-2 whitespace-pre-wrap">{parsedContent.message}</p>
            )}

            {loadingProducts ? (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid gap-2">
                {products.map((product, idx) => {
                  const recommendation = parsedContent.products[idx];
                  const isInDatabase = product.available_in_pharmacy !== false;
                  const displayImage = product.image_url || '/placeholder.svg';
                  const displayPrice = product.price > 0 ? `${product.price.toFixed(2)}€` : null;
                  
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
                          imageUrl: displayImage,
                          reason: recommendation?.reason,
                          source: 'arthur',
                          productId: isInDatabase ? product.id : undefined
                        });
                        setDialogOpen(true);
                      }}
                    >
                      <CardContent className="p-3 flex gap-3">
                        <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                          <img
                            src={displayImage}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).onerror = null;
                              e.currentTarget.src = '/placeholder.svg';
                            }}
                          />
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
