import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Building2, CreditCard, Loader2, Package, Truck, Clock, MapPin, Zap } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import PharmacyLogos from '@/components/PharmacyLogos';
export default function Checkout() {
  const {
    cartId
  } = useParams();
  const navigate = useNavigate();
  const {
    loadCarts
  } = useCart();
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<any>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryType, setDeliveryType] = useState<'standard' | 'express'>('standard');
  const [deliveryLocationType, setDeliveryLocationType] = useState<'home' | 'relay'>('home');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState({
    name: '',
    street: '',
    city: '',
    postal_code: '',
    country: 'France',
    phone: ''
  });
  const [relayPoint, setRelayPoint] = useState({
    id: '',
    name: '',
    address: ''
  });
  useEffect(() => {
    loadCartData();
  }, [cartId]);
  const loadCartData = async () => {
    try {
      setLoading(true);
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        navigate('/cart');
        return;
      }

      // Load cart directly from database
      const {
        data: cartData,
        error: cartError
      } = await supabase.from('carts').select('id, pharmacy_id, status, created_at, updated_at, pharmacies(name)').eq('id', cartId).eq('user_id', user.id).maybeSingle();
      if (cartError || !cartData) {
        toast({
          title: "Erreur",
          description: "Panier introuvable",
          variant: "destructive"
        });
        navigate('/cart');
        return;
      }

      // Load cart items
      const {
        data: itemsData,
        error: itemsError
      } = await supabase.from('cart_items').select('*').eq('cart_id', cartId);
      if (itemsError) throw itemsError;
      const cartWithItems = {
        id: cartData.id,
        pharmacyId: cartData.pharmacy_id,
        pharmacyName: (cartData.pharmacies as any)?.name,
        status: cartData.status,
        createdAt: cartData.created_at,
        updatedAt: cartData.updated_at,
        items: (itemsData || []).map(item => ({
          id: item.id,
          name: item.product_name,
          brand: item.brand,
          price: Number(item.price),
          imageUrl: item.image_url || '',
          quantity: item.quantity,
          source: item.source,
          reason: item.reason || undefined
        }))
      };
      setCart(cartWithItems);
    } catch (error) {
      console.error('Error loading cart:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le panier",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  if (!cart) {
    return <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground">Panier introuvable</p>
            <Button onClick={() => navigate('/cart')} className="mt-4">
              Retour au panier
            </Button>
          </CardContent>
        </Card>
      </div>;
  }
  const cartTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Calculate delivery fees
  const getDeliveryFee = () => {
    if (deliveryMethod === 'pickup') return 0;
    if (deliveryType === 'express') {
      return deliveryLocationType === 'relay' ? 9.90 : 12.90;
    }
    return deliveryLocationType === 'relay' ? 4.90 : 6.90;
  };
  const deliveryFee = getDeliveryFee();
  const totalWithDelivery = cartTotal + deliveryFee;

  // Calculate estimated delivery date
  const getEstimatedDeliveryDate = () => {
    if (deliveryMethod === 'pickup') return null;
    const daysToAdd = deliveryType === 'express' ? 2 : 5;
    return addDays(new Date(), daysToAdd);
  };
  const estimatedDeliveryDate = getEstimatedDeliveryDate();
  const arthurItems = cart.items.filter(item => item.source === 'arthur');
  const shopItems = cart.items.filter(item => item.source === 'shop');
  const promoItems = cart.items.filter(item => item.source === 'promotion');
  const handlePayment = async () => {
    try {
      // Validate delivery info if delivery is selected
      if (deliveryMethod === 'delivery') {
        if (deliveryLocationType === 'home') {
          if (!deliveryAddress.name || !deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.postal_code) {
            toast({
              title: "Adresse incomplète",
              description: "Veuillez renseigner tous les champs de l'adresse de livraison.",
              variant: "destructive"
            });
            return;
          }
        } else if (deliveryLocationType === 'relay') {
          if (!relayPoint.id || !relayPoint.name) {
            toast({
              title: "Point relais non sélectionné",
              description: "Veuillez sélectionner un point relais.",
              variant: "destructive"
            });
            return;
          }
        }
      }
      setProcessingPayment(true);

      // Update cart with delivery info
      const updateData: any = {
        delivery_method: deliveryMethod,
        notification_email: notificationEmail || null
      };
      if (deliveryMethod === 'delivery') {
        updateData.delivery_type = deliveryType;
        updateData.delivery_location_type = deliveryLocationType;
        updateData.estimated_delivery_date = estimatedDeliveryDate?.toISOString();
        if (deliveryLocationType === 'home') {
          updateData.delivery_address = deliveryAddress;
        } else {
          updateData.relay_point_id = relayPoint.id;
          updateData.relay_point_name = relayPoint.name;
          updateData.relay_point_address = relayPoint.address;
        }
      }
      const {
        error: updateError
      } = await supabase.from('carts').update(updateData as any).eq('id', cart.id);
      if (updateError) throw updateError;

      // Create checkout session
      const {
        data,
        error
      } = await supabase.functions.invoke('create-cart-checkout', {
        body: {
          cartId: cart.id
        }
      });
      if (error) throw error;
      if (data?.url) {
        // Ouvrir Stripe dans un nouvel onglet (meilleure compatibilité en preview)
        const newWin = window.open(data.url, '_blank', 'noopener,noreferrer');
        if (!newWin) {
          // Fallback si le pop-up est bloqué
          window.location.href = data.url;
        }
        setProcessingPayment(false);
        return;
      } else {
        throw new Error(data?.message || 'Aucune URL de paiement reçue');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du paiement. Veuillez réessayer.",
        variant: "destructive"
      });
      setProcessingPayment(false);
    }
  };
  return <div className="min-h-screen bg-background p-4 pb-44 overflow-auto" style={{
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)'
  }}>
      <div className="max-w-3xl mx-auto">
        {/* Header with Logos and Back Button */}
        <div className="flex items-center justify-between mb-6">
          <PharmacyLogos size="md" />
          <Button variant="ghost" onClick={() => navigate('/cart')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>

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
              {cart.items.map(item => <div key={item.id} className="flex gap-4 items-center">
                  {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-md" loading="lazy" onError={e => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/placeholder.svg';
              }} />}
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.brand}</p>
                    <p className="text-xs text-muted-foreground">Quantité: {item.quantity}</p>
                  </div>
                  {item.price > 0 && <p className="text-sm font-bold text-primary">
                      {(item.price * item.quantity).toFixed(2)} €
                    </p>}
                </div>)}
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
                      <div className="font-medium">Retrait en pharmacie GRATUIT </div>
                      
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setDeliveryMethod('delivery')}>
                  <RadioGroupItem value="delivery" id="delivery" />
                  <Label htmlFor="delivery" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Truck className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">Livraison</div>
                      
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary">À partir de 4,90 €</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {deliveryMethod === 'delivery' && <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  {/* Delivery speed selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Vitesse de livraison</Label>
                    <RadioGroup value={deliveryType} onValueChange={(v: 'standard' | 'express') => setDeliveryType(v)}>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setDeliveryType('standard')}>
                        <RadioGroupItem value="standard" id="standard" />
                        <Label htmlFor="standard" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Clock className="h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">Standard</div>
                            <div className="text-xs text-muted-foreground">5 jours ouvrés</div>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setDeliveryType('express')}>
                        <RadioGroupItem value="express" id="express" />
                        <Label htmlFor="express" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Zap className="h-4 w-4 text-orange-500" />
                          <div className="flex-1">
                            <div className="font-medium">Express</div>
                            <div className="text-xs text-muted-foreground">2 jours ouvrés</div>
                          </div>
                          <Badge variant="secondary" className="text-xs">+3€</Badge>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Delivery location type selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Lieu de livraison</Label>
                    <RadioGroup value={deliveryLocationType} onValueChange={(v: 'home' | 'relay') => setDeliveryLocationType(v)}>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setDeliveryLocationType('home')}>
                        <RadioGroupItem value="home" id="home" />
                        <Label htmlFor="home" className="flex items-center gap-2 cursor-pointer flex-1">
                          <MapPin className="h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">À domicile</div>
                            <div className="text-xs text-muted-foreground">
                              {deliveryType === 'express' ? '12,90 €' : '6,90 €'}
                            </div>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setDeliveryLocationType('relay')}>
                        <RadioGroupItem value="relay" id="relay" />
                        <Label htmlFor="relay" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Package className="h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">Point relais</div>
                            <div className="text-xs text-muted-foreground">
                              {deliveryType === 'express' ? '9,90 €' : '4,90 €'}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">-2€</Badge>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Estimated delivery date */}
                  {estimatedDeliveryDate && <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium">Livraison estimée:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          {format(estimatedDeliveryDate, 'EEEE dd MMMM yyyy', {
                      locale: fr
                    })}
                        </span>
                      </div>
                    </div>}

                  {/* Address or relay point input */}
                  {deliveryLocationType === 'home' ? <div className="space-y-3">
                      <h4 className="font-semibold text-sm">Adresse de livraison</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Nom complet" value={deliveryAddress.name} onChange={e => setDeliveryAddress({
                    ...deliveryAddress,
                    name: e.target.value
                  })} className="col-span-2" />
                        <Input placeholder="Rue et numéro" value={deliveryAddress.street} onChange={e => setDeliveryAddress({
                    ...deliveryAddress,
                    street: e.target.value
                  })} className="col-span-2" />
                        <Input placeholder="Code postal" value={deliveryAddress.postal_code} onChange={e => setDeliveryAddress({
                    ...deliveryAddress,
                    postal_code: e.target.value
                  })} />
                        <Input placeholder="Ville" value={deliveryAddress.city} onChange={e => setDeliveryAddress({
                    ...deliveryAddress,
                    city: e.target.value
                  })} />
                        <Input placeholder="Téléphone" value={deliveryAddress.phone} onChange={e => setDeliveryAddress({
                    ...deliveryAddress,
                    phone: e.target.value
                  })} className="col-span-2" />
                      </div>
                    </div> : <div className="space-y-3">
                      <h4 className="font-semibold text-sm">Point relais</h4>
                      <div className="p-4 border rounded-lg bg-background">
                        <p className="text-sm text-muted-foreground mb-3">
                          Sélectionnez votre point relais après le paiement. Vous recevrez un email avec la liste des points relais disponibles.
                        </p>
                        <Input placeholder="Code postal pour recherche" value={relayPoint.address} onChange={e => setRelayPoint({
                    ...relayPoint,
                    address: e.target.value,
                    id: 'pending',
                    name: 'À sélectionner'
                  })} />
                      </div>
                    </div>}
                </div>}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email de notification (optionnel)</Label>
                <Input id="email" type="email" placeholder="votre@email.com" value={notificationEmail} onChange={e => setNotificationEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Recevez une notification quand votre commande est {deliveryMethod === 'delivery' ? 'expédiée' : 'prête à être retirée'}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              {arthurItems.length > 0 && <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="bg-primary/10 text-xs">Arthur</Badge>
                    ({arthurItems.reduce((sum, item) => sum + item.quantity, 0)})
                  </span>
                  <span>{arthurItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
                </div>}
              {shopItems.length > 0 && <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">Boutique</Badge>
                    ({shopItems.reduce((sum, item) => sum + item.quantity, 0)})
                  </span>
                  <span>{shopItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
                </div>}
              {promoItems.length > 0 && <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="bg-orange-100 text-xs">Promos</Badge>
                    ({promoItems.reduce((sum, item) => sum + item.quantity, 0)})
                  </span>
                  <span>{promoItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
                </div>}
              {deliveryMethod === 'delivery' && <div className="flex justify-between text-sm pt-2">
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Frais de livraison
                  </span>
                  <span className="font-medium text-primary">{deliveryFee.toFixed(2)} €</span>
                </div>}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">{totalWithDelivery.toFixed(2)} €</span>
              </div>
            </div>

            <Button className="w-full mt-6 bg-gradient-primary" onClick={handlePayment} disabled={processingPayment || cartTotal === 0}>
              {processingPayment ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirection vers le paiement...
                </> : <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Payer {totalWithDelivery.toFixed(2)} €
                </>}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Paiement sécurisé par Stripe. 
              {deliveryMethod === 'delivery' ? ` Votre commande sera ${deliveryLocationType === 'relay' ? 'disponible en point relais' : 'livrée à domicile'} ${estimatedDeliveryDate ? format(estimatedDeliveryDate, "'le' dd/MM/yyyy", {
              locale: fr
            }) : 'sous quelques jours'}.` : ' Vous pourrez retirer votre commande à la pharmacie après paiement.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>;
}