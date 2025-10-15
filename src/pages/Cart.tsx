import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  id: string;
  name: string;
  price: number;
  brand: string;
  category: string;
  image_url: string;
  quantity: number;
  source: 'selection' | 'recommendation';
}

const Cart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Load selected products from localStorage
      const selectedProducts = JSON.parse(localStorage.getItem('selectedProducts') || '[]');
      
      // Load recommendations from database
      const { data: recommendations, error } = await supabase
        .from("recommendations")
        .select("product_name, notes")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const items: CartItem[] = [];

      // Add selected products
      if (selectedProducts.length > 0) {
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("*")
          .in("id", selectedProducts);

        if (productsError) throw productsError;

        products?.forEach(product => {
          items.push({
            id: product.id,
            name: product.name,
            price: product.price,
            brand: product.brand,
            category: product.category,
            image_url: product.image_url,
            quantity: 1,
            source: 'selection'
          });
        });
      }

      // Add recommended products (using product_name from recommendations)
      recommendations?.forEach((rec, index) => {
        if (rec.product_name) {
          // Create a temporary item for recommended products
          items.push({
            id: `rec-${index}`,
            name: rec.product_name,
            price: 0, // Price unknown from recommendations
            brand: "Recommandé par Arthur",
            category: "Recommandation",
            image_url: "",
            quantity: 1,
            source: 'recommendation'
          });
        }
      });

      setCartItems(items);
    } catch (error) {
      console.error("Error loading cart:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le panier.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (itemId: string, change: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + change);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    const item = cartItems.find(i => i.id === itemId);
    
    setCartItems(prev => prev.filter(item => item.id !== itemId));

    // Update localStorage if it's a selected product
    if (item?.source === 'selection') {
      const selectedProducts = JSON.parse(localStorage.getItem('selectedProducts') || '[]');
      const updated = selectedProducts.filter((id: string) => id !== itemId);
      localStorage.setItem('selectedProducts', JSON.stringify(updated));
    }

    toast({
      title: "Produit retiré",
      description: "Le produit a été retiré du panier.",
    });
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('selectedProducts');
    toast({
      title: "Panier vidé",
      description: "Tous les produits ont été retirés du panier.",
    });
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const selectionItems = cartItems.filter(i => i.source === 'selection');
  const recommendationItems = cartItems.filter(i => i.source === 'recommendation');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <ShoppingBag className="h-8 w-8" />
                Mon Panier
              </h1>
              <p className="text-muted-foreground">
                {cartItems.length} article(s)
              </p>
            </div>
            {cartItems.length > 0 && (
              <Button variant="outline" onClick={clearCart}>
                Vider le panier
              </Button>
            )}
          </div>
        </div>

        {cartItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground mb-4">
                Votre panier est vide
              </p>
              <Button onClick={() => navigate('/shop')}>
                Découvrir la boutique
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Selected Products */}
            {selectionItems.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Produits sélectionnés</h2>
                <div className="space-y-4">
                  {selectionItems.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-24 h-24 object-cover rounded-md"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-semibold">{item.name}</h3>
                                <p className="text-sm text-muted-foreground">{item.brand}</p>
                                <Badge variant="secondary" className="mt-1">
                                  {item.category}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateQuantity(item.id, -1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-12 text-center font-medium">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateQuantity(item.id, 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <p className="text-lg font-bold text-primary">
                                {(item.price * item.quantity).toFixed(2)} €
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Products */}
            {recommendationItems.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  Recommandations d'Arthur
                  <Badge variant="outline">IA</Badge>
                </h2>
                <div className="space-y-4">
                  {recommendationItems.map((item) => (
                    <Card key={item.id} className="border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-semibold">{item.name}</h3>
                                <p className="text-sm text-muted-foreground">{item.brand}</p>
                                <Badge variant="secondary" className="mt-1">
                                  {item.category}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                              Ce produit a été recommandé par Arthur lors de votre consultation
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {selectionItems.length > 0 && (
              <>
                <Separator />
                <Card>
                  <CardHeader>
                    <CardTitle>Récapitulatif</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Sous-total ({selectionItems.reduce((sum, item) => sum + item.quantity, 0)} articles)</span>
                        <span>{totalPrice.toFixed(2)} €</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span className="text-primary">{totalPrice.toFixed(2)} €</span>
                      </div>
                    </div>
                    <Button className="w-full mt-4" size="lg">
                      Passer la commande
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Les produits recommandés nécessitent une confirmation avec votre pharmacie
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
