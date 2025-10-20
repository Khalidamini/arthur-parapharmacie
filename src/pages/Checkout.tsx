import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, CreditCard, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Checkout() {
  const { cartId } = useParams();
  const navigate = useNavigate();
  const { activeCarts, loadCarts } = useCart();
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  const cart = activeCarts.find(c => c.id === cartId);

  useEffect(() => {
    loadCarts();
  }, [cartId]);

  if (!cart) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground">Panier introuvable</p>
            <Button onClick={() => navigate('/cart')} className="mt-4">
              Retour au panier
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cartTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const arthurItems = cart.items.filter(item => item.source === 'arthur');
  const shopItems = cart.items.filter(item => item.source === 'shop');
  const promoItems = cart.items.filter(item => item.source === 'promotion');

  const handlePayment = async () => {
    try {
      setProcessingPayment(true);
      
      // Create checkout session
      const { data, error } = await supabase.functions.invoke('create-cart-checkout', {
        body: { cartId: cart.id }
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du paiement. Veuillez réessayer.",
        variant: "destructive",
      });
      setProcessingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/cart')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au panier
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">
                {cart.pharmacyName || 'Panier général'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex gap-4 items-center">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-md"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.brand}</p>
                    <p className="text-xs text-muted-foreground">Quantité: {item.quantity}</p>
                  </div>
                  {item.price > 0 && (
                    <p className="text-sm font-bold text-primary">
                      {(item.price * item.quantity).toFixed(2)} €
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              {arthurItems.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="bg-primary/10 text-xs">Arthur</Badge>
                    ({arthurItems.reduce((sum, item) => sum + item.quantity, 0)})
                  </span>
                  <span>{arthurItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
                </div>
              )}
              {shopItems.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">Boutique</Badge>
                    ({shopItems.reduce((sum, item) => sum + item.quantity, 0)})
                  </span>
                  <span>{shopItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
                </div>
              )}
              {promoItems.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="bg-orange-100 text-xs">Promos</Badge>
                    ({promoItems.reduce((sum, item) => sum + item.quantity, 0)})
                  </span>
                  <span>{promoItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">{cartTotal.toFixed(2)} €</span>
              </div>
            </div>

            <Button 
              className="w-full mt-6 bg-gradient-primary" 
              onClick={handlePayment}
              disabled={processingPayment || cartTotal === 0}
            >
              {processingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirection vers le paiement...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Payer {cartTotal.toFixed(2)} €
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Paiement sécurisé par Stripe. Vous pourrez retirer votre commande à la pharmacie après paiement.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
