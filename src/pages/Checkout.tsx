import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Building2, CreditCard, Loader2, Package, Truck } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Checkout() {
  const { cartId } = useParams();
  const navigate = useNavigate();
  const { activeCarts, loadCarts } = useCart();
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState({
    name: '',
    street: '',
    city: '',
    postal_code: '',
    country: 'France',
    phone: '',
  });
  
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
  const deliveryFee = deliveryMethod === 'delivery' ? 6.90 : 0;
  const totalWithDelivery = cartTotal + deliveryFee;
  const arthurItems = cart.items.filter(item => item.source === 'arthur');
  const shopItems = cart.items.filter(item => item.source === 'shop');
  const promoItems = cart.items.filter(item => item.source === 'promotion');

  const handlePayment = async () => {
    try {
      // Validate delivery address if delivery is selected
      if (deliveryMethod === 'delivery') {
        if (!deliveryAddress.name || !deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.postal_code) {
          toast({
            title: "Adresse incomplète",
            description: "Veuillez renseigner tous les champs de l'adresse de livraison.",
            variant: "destructive",
          });
          return;
        }
      }

      setProcessingPayment(true);

      // Update cart with delivery info
      const { error: updateError } = await supabase
        .from('carts')
        .update({
          delivery_method: deliveryMethod,
          delivery_address: deliveryMethod === 'delivery' ? deliveryAddress : null,
          notification_email: notificationEmail || null,
        })
        .eq('id', cart.id);

      if (updateError) throw updateError;
      
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
    <div className="min-h-screen bg-background p-4 pb-32">
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

            {/* Delivery method selection */}
            <div className="space-y-4 mb-4">
              <Label className="text-base font-semibold">Mode de récupération</Label>
              <RadioGroup value={deliveryMethod} onValueChange={(v: 'pickup' | 'delivery') => setDeliveryMethod(v)}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setDeliveryMethod('pickup')}>
                  <RadioGroupItem value="pickup" id="pickup" />
                  <Label htmlFor="pickup" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Package className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Retrait en pharmacie</div>
                      <div className="text-xs text-muted-foreground">Gratuit</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setDeliveryMethod('delivery')}>
                  <RadioGroupItem value="delivery" id="delivery" />
                  <Label htmlFor="delivery" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Truck className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">Livraison à domicile</div>
                      <div className="text-xs text-muted-foreground">Via Shipy (La Poste, Chronopost...)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary">6,90 €</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {deliveryMethod === 'delivery' && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold text-sm">Adresse de livraison</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Nom complet"
                      value={deliveryAddress.name}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, name: e.target.value})}
                      className="col-span-2"
                    />
                    <Input
                      placeholder="Rue et numéro"
                      value={deliveryAddress.street}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, street: e.target.value})}
                      className="col-span-2"
                    />
                    <Input
                      placeholder="Code postal"
                      value={deliveryAddress.postal_code}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, postal_code: e.target.value})}
                    />
                    <Input
                      placeholder="Ville"
                      value={deliveryAddress.city}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, city: e.target.value})}
                    />
                    <Input
                      placeholder="Téléphone"
                      value={deliveryAddress.phone}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, phone: e.target.value})}
                      className="col-span-2"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email de notification (optionnel)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Recevez une notification quand votre commande est {deliveryMethod === 'delivery' ? 'expédiée' : 'prête à être retirée'}
                </p>
              </div>
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
              {deliveryMethod === 'delivery' && (
                <div className="flex justify-between text-sm pt-2">
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Frais de livraison
                  </span>
                  <span className="font-medium text-primary">{deliveryFee.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">{totalWithDelivery.toFixed(2)} €</span>
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
                  Payer {totalWithDelivery.toFixed(2)} €
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Paiement sécurisé par Stripe. {deliveryMethod === 'delivery' ? 'Votre commande sera expédiée après paiement.' : 'Vous pourrez retirer votre commande à la pharmacie après paiement.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
