import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, Building2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import Footer from '@/components/Footer';

export default function Cart() {
  const navigate = useNavigate();
  const { activeCarts, cartHistory, updateQuantity, removeFromCart, clearCart, completeCart, loadCarts, selectedPharmacyId } = useCart();

  useEffect(() => {
    loadCarts();
  }, []);

  const filteredActiveCarts = selectedPharmacyId 
    ? activeCarts.filter(cart => cart.pharmacyId === selectedPharmacyId)
    : activeCarts;

  const renderCartItems = (cart: any) => (
    <div className="space-y-3">
      {cart.items.map((item: any) => (
        <Card key={item.id} className={item.source === 'arthur' ? "border-primary/30 bg-primary/5" : ""}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-md"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              )}
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.brand}</p>
                    {item.source === 'arthur' && item.reason && (
                      <p className="text-xs text-muted-foreground mt-1 bg-muted/50 p-1.5 rounded">
                        💡 {item.reason}
                      </p>
                    )}
                  </div>
                  {cart.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  {cart.status === 'active' ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Quantité: {item.quantity}</span>
                  )}
                  {item.price > 0 && (
                    <p className="text-sm font-bold text-primary">
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
  );

  const renderCart = (cart: any) => {
    const cartTotal = cart.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    const arthurItems = cart.items.filter((item: any) => item.source === 'arthur');

    return (
      <Card key={cart.id} className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {cart.pharmacyName || 'Panier général'}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearCart(cart.id)}
            >
              Vider
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {renderCartItems(cart)}
          
          <Separator className="my-4" />
          
          <div className="space-y-2">
            {arthurItems.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Badge variant="outline" className="bg-primary/10 text-xs">IA</Badge>
                  Recommandations ({arthurItems.reduce((sum: number, item: any) => sum + item.quantity, 0)})
                </span>
                <span>{arthurItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{cartTotal.toFixed(2)} €</span>
            </div>
          </div>

          <Button 
            className="w-full mt-4 bg-gradient-primary" 
            onClick={() => completeCart(cart.id)}
          >
            Valider la commande
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Mon Panier</h1>
          </div>
        </div>

        {filteredActiveCarts.length === 0 ? (
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
          filteredActiveCarts.map(cart => renderCart(cart))
        )}
      </div>
      <Footer />
    </div>
  );
}
