import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import Footer from '@/components/Footer';

const Cart = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart, totalPrice, arthurItems, shopItems } = useCart();

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
                {items.length} article(s)
              </p>
            </div>
            {items.length > 0 && (
              <Button variant="outline" onClick={clearCart}>
                Vider le panier
              </Button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground mb-4">
                Votre panier est vide
              </p>
              <Button onClick={() => navigate('/chat')}>
                Consulter Arthur
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Recommended by Arthur */}
            {arthurItems.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  Recommandés par Arthur
                  <Badge variant="outline" className="bg-primary/10">IA</Badge>
                </h2>
                <div className="space-y-4">
                  {arthurItems.map((item) => (
                    <Card key={item.id} className="border-primary/30 bg-primary/5">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-24 h-24 object-cover rounded-md"
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/placeholder.svg';
                              }}
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-semibold">{item.name}</h3>
                                <p className="text-sm text-muted-foreground">{item.brand}</p>
                                {item.reason && (
                                  <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                                    💡 {item.reason}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-12 text-center font-medium">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              {item.price > 0 && (
                                <p className="text-lg font-bold text-primary">
                                  {(item.price * item.quantity).toFixed(2)} €
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Shop Products */}
            {shopItems.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Produits de la boutique</h2>
                <div className="space-y-4">
                  {shopItems.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-24 h-24 object-cover rounded-md"
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/placeholder.svg';
                              }}
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-semibold">{item.name}</h3>
                                <p className="text-sm text-muted-foreground">{item.brand}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-12 text-center font-medium">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
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

            {/* Summary */}
            <Separator />
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {arthurItems.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Recommandations Arthur ({arthurItems.reduce((sum, item) => sum + item.quantity, 0)} articles)</span>
                      <span>{arthurItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
                    </div>
                  )}
                  {shopItems.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Boutique ({shopItems.reduce((sum, item) => sum + item.quantity, 0)} articles)</span>
                      <span>{shopItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">{totalPrice.toFixed(2)} €</span>
                  </div>
                </div>
                <Button className="w-full mt-6 bg-gradient-primary" size="lg">
                  Passer la commande
                </Button>
                {arthurItems.length > 0 && (
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    Les produits recommandés par Arthur seront confirmés avec votre pharmacie
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Cart;
