import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingBag, Calendar, Package, MapPin, Truck, ExternalLink } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Footer from '@/components/Footer';
import PharmacyLogos from '@/components/PharmacyLogos';

interface CartItem {
  id: string;
  product_name: string;
  brand: string;
  price: number;
  quantity: number;
  source: string;
  image_url: string | null;
  reason: string | null;
}

interface Order {
  id: string;
  created_at: string;
  completed_at: string | null;
  amount_total: number;
  payment_status: string;
  ready_for_pickup: boolean;
  delivery_method: string;
  delivery_type?: string;
  delivery_location_type?: string;
  estimated_delivery_date?: string | null;
  delivery_address: any;
  relay_point_name?: string | null;
  relay_point_address?: string | null;
  shipping_tracking_number: string | null;
  delivery_status?: string | null;
  items: CartItem[];
  pharmacy: {
    name: string;
    address: string;
    city: string;
    phone: string | null;
  };
}

const MyOrders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      // Load completed and paid orders
      const { data: cartsData, error: cartsError } = await supabase
        .from('carts')
        .select(`
          id,
          created_at,
          completed_at,
          amount_total,
          payment_status,
          ready_for_pickup,
          delivery_method,
          delivery_type,
          delivery_location_type,
          estimated_delivery_date,
          delivery_address,
          relay_point_name,
          relay_point_address,
          shipping_tracking_number,
          delivery_status,
          pharmacy:pharmacies(name, address, city, phone)
        `)
        .eq('user_id', user.id)
        .eq('payment_status', 'paid')
        .order('completed_at', { ascending: false });

      if (cartsError) throw cartsError;

      // Load items for all orders
      const cartIds = cartsData?.map(c => c.id) || [];
      const { data: itemsData, error: itemsError } = await supabase
        .from('cart_items')
        .select('*')
        .in('cart_id', cartIds);

      if (itemsError) throw itemsError;

      // Organize data
      const ordersWithItems: Order[] = (cartsData || []).map(cart => ({
        ...cart,
        items: (itemsData || []).filter(item => item.cart_id === cart.id)
      }));

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos commandes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (order: Order) => {
    if (order.delivery_method === 'delivery') {
      if (order.shipping_tracking_number) {
        return <Badge variant="default" className="bg-blue-500">En cours de livraison</Badge>;
      }
      return <Badge variant="secondary">En préparation</Badge>;
    } else {
      if (order.ready_for_pickup) {
        return <Badge variant="default" className="bg-green-500">Prête à retirer</Badge>;
      }
      return <Badge variant="secondary">En préparation</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement de vos commandes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Logos */}
        <div className="flex justify-center items-center mb-6">
          <PharmacyLogos size="md" />
        </div>

        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à l'accueil
        </Button>
        
        <div className="flex items-center gap-3 mb-6">
          <ShoppingBag className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Mes commandes</h1>
            <p className="text-muted-foreground">{orders.length} commande(s)</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune commande</h3>
              <p className="text-muted-foreground mb-4">
                Vous n'avez pas encore passé de commande.
              </p>
              <Button onClick={() => navigate('/shop')}>
                Découvrir nos produits
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {order.pharmacy.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Commandé le {format(new Date(order.completed_at || order.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(order)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {Number(order.amount_total).toFixed(2)} €
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Order items */}
                    <div>
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Articles ({order.items.length})
                      </h4>
                      <div className="space-y-2">
                        {order.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              {item.image_url && (
                                <img 
                                  src={item.image_url} 
                                  alt={item.product_name}
                                  className="w-12 h-12 object-cover rounded"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = '/placeholder.svg';
                                  }}
                                />
                              )}
                              <div>
                                <p className="font-medium text-sm">{item.product_name}</p>
                                <p className="text-xs text-muted-foreground">{item.brand}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">x{item.quantity}</p>
                              <p className="font-medium">{(item.price * item.quantity).toFixed(2)} €</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Delivery/Pickup info */}
                    <div className="border-t pt-4">
                      {order.delivery_method === 'delivery' ? (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            Livraison {order.delivery_type === 'express' ? 'Express' : 'Standard'}
                            {order.delivery_location_type === 'relay' ? ' - Point relais' : ' - À domicile'}
                          </h4>
                          
                          {order.estimated_delivery_date && (
                            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg mb-3">
                              <p className="text-sm font-medium">Date de livraison estimée</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(order.estimated_delivery_date), 'EEEE dd MMMM yyyy', { locale: fr })}
                              </p>
                            </div>
                          )}

                          {order.shipping_tracking_number && (
                            <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg space-y-2 mb-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">Suivi de livraison</p>
                                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                                    {order.shipping_tracking_number}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(`https://www.sendcloud.fr/tracking/?tracking_number=${order.shipping_tracking_number}`, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Suivre
                                </Button>
                              </div>
                              {order.delivery_status && (
                                <div className="text-xs bg-background/50 p-2 rounded">
                                  Statut: <span className="font-medium">{order.delivery_status}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {!order.shipping_tracking_number && (
                            <div className="bg-muted/50 p-3 rounded-lg mb-3">
                              <p className="text-xs text-muted-foreground">
                                ⏳ Étiquette d'expédition en cours de génération...
                              </p>
                            </div>
                          )}
                          
                          {order.delivery_location_type === 'relay' && order.relay_point_name ? (
                            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                              <p className="font-medium text-sm flex items-center gap-2">
                                <Package className="h-3 w-3" />
                                {order.relay_point_name}
                              </p>
                              {order.relay_point_address && (
                                <p className="text-xs text-muted-foreground">{order.relay_point_address}</p>
                              )}
                            </div>
                          ) : order.delivery_address && (
                            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                              <p className="font-medium text-sm flex items-center gap-2">
                                <MapPin className="h-3 w-3" />
                                Adresse de livraison
                              </p>
                              <p className="text-xs">{order.delivery_address.name}</p>
                              <p className="text-xs">{order.delivery_address.street}</p>
                              <p className="text-xs">
                                {order.delivery_address.postal_code} {order.delivery_address.city}
                              </p>
                              {order.delivery_address.phone && (
                                <p className="text-xs">📱 {order.delivery_address.phone}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Retrait en pharmacie
                          </h4>
                          <div className="text-sm">
                            <p className="font-medium">{order.pharmacy.name}</p>
                            <p className="text-muted-foreground">{order.pharmacy.address}</p>
                            <p className="text-muted-foreground">{order.pharmacy.city}</p>
                            {order.pharmacy.phone && (
                              <p className="text-muted-foreground">Tél: {order.pharmacy.phone}</p>
                            )}
                          </div>
                          {order.ready_for_pickup && (
                            <div className="mt-2 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                              <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                                ✓ Votre commande est prête à être retirée !
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                N'oubliez pas d'apporter une pièce d'identité
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default MyOrders;