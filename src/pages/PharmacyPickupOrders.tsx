import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePharmacyActivityLog } from "@/hooks/usePharmacyActivityLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingBag, User, Calendar, Package, Search, Bell, CheckCircle } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PharmacyLayout from '@/layouts/PharmacyLayout';

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

interface Cart {
  id: string;
  user_id: string;
  status: string;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  ready_for_pickup: boolean;
  notification_sent_at: string | null;
  preparation_notified_at?: string | null;
  pickup_message: string | null;
  amount_total: number;
  items: CartItem[];
  profiles?: {
    email: string;
    qr_code_number: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  };
}

const PharmacyPickupOrders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logActivity } = usePharmacyActivityLog();
  const [loading, setLoading] = useState(true);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [filteredCarts, setFilteredCarts] = useState<Cart[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [pharmacyName, setPharmacyName] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('date-desc');

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if (!pharmacyId) return;

    const channel = supabase
      .channel('pharmacy-pickup-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'carts',
          filter: `pharmacy_id=eq.${pharmacyId}`
        },
        (payload) => {
          console.log('Realtime cart change:', payload);
          loadCarts(pharmacyId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pharmacyId]);

  useEffect(() => {
    filterAndSortCarts();
  }, [carts, statusFilter, searchQuery, sortBy]);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/pharmacy-login');
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('pharmacy_id, pharmacies(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError || !roleData) {
        toast({
          title: "Accès non autorisé",
          description: "Vous n'avez pas les permissions nécessaires.",
          variant: "destructive",
        });
        navigate('/pharmacy-login');
        return;
      }

      setPharmacyId(roleData.pharmacy_id);
      setPharmacyName((roleData.pharmacies as any).name);
      await loadCarts(roleData.pharmacy_id);
    } catch (error) {
      console.error('Error checking auth:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la vérification de l'authentification.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCarts = async (pharmacyId: string) => {
    try {
      const { data: cartsData, error: cartsError } = await supabase
        .from('carts')
        .select('*')
        .eq('pharmacy_id', pharmacyId)
        .eq('delivery_method', 'pickup')
        .in('status', ['active', 'completed'])
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false });

      if (cartsError) throw cartsError;

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, qr_code_number, username, first_name, last_name, phone');

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData.map(p => [p.id, p]));

      const cartsWithItems = await Promise.all(
        (cartsData || []).map(async (cart) => {
          const { data: items } = await supabase
            .from('cart_items')
            .select('*')
            .eq('cart_id', cart.id);

          return {
            ...cart,
            items: items || [],
            profiles: profilesMap.get(cart.user_id)
          };
        })
      );

      setCarts(cartsWithItems);
    } catch (error) {
      console.error('Error loading carts:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les commandes.",
        variant: "destructive",
      });
    }
  };

  const filterAndSortCarts = () => {
    let filtered = [...carts];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(cart => {
        if (statusFilter === 'pending') return !cart.preparation_notified_at;
        if (statusFilter === 'preparation') return cart.preparation_notified_at && !cart.ready_for_pickup;
        if (statusFilter === 'ready') return cart.ready_for_pickup && cart.status !== 'completed';
        if (statusFilter === 'completed') return cart.status === 'completed';
        return true;
      });
    }

    if (searchQuery) {
      filtered = filtered.filter(cart => {
        const profile = cart.profiles;
        const searchLower = searchQuery.toLowerCase();
        return (
          profile?.email?.toLowerCase().includes(searchLower) ||
          profile?.username?.toLowerCase().includes(searchLower) ||
          profile?.first_name?.toLowerCase().includes(searchLower) ||
          profile?.last_name?.toLowerCase().includes(searchLower) ||
          profile?.qr_code_number?.includes(searchQuery)
        );
      });
    }

    filtered.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'date-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'amount-desc') return (b.amount_total || 0) - (a.amount_total || 0);
      if (sortBy === 'amount-asc') return (a.amount_total || 0) - (b.amount_total || 0);
      return 0;
    });

    setFilteredCarts(filtered);
  };

  const handleNotifyPreparation = async (cartId: string, userEmail: string | undefined, cart: Cart) => {
    try {
      await supabase.functions.invoke('notify-customer-order-preparation', {
        body: { cartId }
      });

      const { error: updateError } = await supabase
        .from('carts')
        .update({ preparation_notified_at: new Date().toISOString() } as any)
        .eq('id', cartId);

      if (updateError) throw updateError;

      if (pharmacyId) {
        await logActivity({
          pharmacyId,
          actionType: 'order_preparation_notified',
          actionDetails: {
            cart_id: cartId,
            customer_email: userEmail,
            amount: cart.amount_total
          },
          entityType: 'cart',
          entityId: cartId
        });
      }

      toast({
        title: "Notification envoyée",
        description: "Le client a été notifié que sa commande est en préparation.",
      });

      if (pharmacyId) loadCarts(pharmacyId);
    } catch (error) {
      console.error('Error notifying preparation:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la notification.",
        variant: "destructive",
      });
    }
  };

  const handleNotifyReady = async (cartId: string, userEmail: string | undefined, cart: Cart) => {
    try {
      await supabase.functions.invoke('notify-customer-order-ready', {
        body: { cartId }
      });

      const { error: updateError } = await supabase
        .from('carts')
        .update({
          ready_for_pickup: true,
          notification_sent_at: new Date().toISOString()
        })
        .eq('id', cartId);

      if (updateError) throw updateError;

      if (pharmacyId) {
        await logActivity({
          pharmacyId,
          actionType: 'order_ready_notified',
          actionDetails: {
            cart_id: cartId,
            customer_email: userEmail,
            amount: cart.amount_total
          },
          entityType: 'cart',
          entityId: cartId
        });
      }

      toast({
        title: "Notification envoyée",
        description: "Le client a été notifié que sa commande est prête à être retirée.",
      });

      if (pharmacyId) loadCarts(pharmacyId);
    } catch (error) {
      console.error('Error notifying ready:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la notification.",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsPickedUp = async (cartId: string, userEmail: string | undefined, cart: Cart) => {
    try {
      await supabase.functions.invoke('notify-customer-order-picked-up', {
        body: { cartId }
      });

      const { error: updateError } = await supabase
        .from('carts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', cartId);

      if (updateError) throw updateError;

      if (pharmacyId) {
        await logActivity({
          pharmacyId,
          actionType: 'order_completed',
          actionDetails: {
            cart_id: cartId,
            customer_email: userEmail,
            amount: cart.amount_total
          },
          entityType: 'cart',
          entityId: cartId
        });
      }

      toast({
        title: "Commande terminée",
        description: "La commande a été marquée comme retirée.",
      });

      if (pharmacyId) loadCarts(pharmacyId);
    } catch (error) {
      console.error('Error marking as picked up:', error);
      toast({
        title: "Erreur",
        description: "Impossible de marquer la commande comme retirée.",
        variant: "destructive",
      });
    }
  };

  const getOrderStats = () => {
    const pending = carts.filter(c => !c.preparation_notified_at).length;
    const preparation = carts.filter(c => c.preparation_notified_at && !c.ready_for_pickup).length;
    const ready = carts.filter(c => c.ready_for_pickup && c.status !== 'completed').length;
    const completed = carts.filter(c => c.status === 'completed').length;

    return { pending, preparation, ready, completed };
  };

  if (loading) {
    return (
      <PharmacyLayout pharmacyId={pharmacyId || undefined}>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </PharmacyLayout>
    );
  }

  const stats = getOrderStats();

  return (
    <PharmacyLayout pharmacyId={pharmacyId || undefined}>
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/pharmacy-dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Retour</span>
            </Button>
          </div>

          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Commandes à Emporter</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{pharmacyName}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">En Attente</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">En Préparation</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{stats.preparation}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Prêtes</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{stats.ready}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Terminées</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{stats.completed}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="px-3 sm:px-6">
              <div className="flex flex-col gap-3">
                <CardTitle className="text-base sm:text-lg">Filtrer et Trier</CardTitle>
                <div className="flex flex-col gap-2">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes</SelectItem>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="preparation">En préparation</SelectItem>
                        <SelectItem value="ready">Prêtes</SelectItem>
                        <SelectItem value="completed">Terminées</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Trier par" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Plus récentes</SelectItem>
                        <SelectItem value="date-asc">Plus anciennes</SelectItem>
                        <SelectItem value="amount-desc">Montant ↓</SelectItem>
                        <SelectItem value="amount-asc">Montant ↑</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {filteredCarts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-foreground mb-2">Aucune commande</p>
                <p className="text-muted-foreground">Aucune commande à emporter trouvée avec ces critères.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredCarts.map((cart) => (
                <Card key={cart.id}>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {cart.profiles?.first_name && cart.profiles?.last_name
                              ? `${cart.profiles.first_name} ${cart.profiles.last_name}`
                              : cart.profiles?.username || cart.profiles?.email || 'Client inconnu'}
                          </span>
                        </div>
                        {cart.profiles?.phone && (
                          <p className="text-sm text-muted-foreground">📱 {cart.profiles.phone}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(cart.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-2xl font-bold text-primary">
                          {cart.amount_total?.toFixed(2)} €
                        </div>
                        {cart.status === 'completed' && (
                          <Badge variant="default" className="bg-green-500">Terminée</Badge>
                        )}
                        {cart.ready_for_pickup && cart.status !== 'completed' && (
                          <Badge variant="default" className="bg-blue-500">Prête à retirer</Badge>
                        )}
                        {cart.preparation_notified_at && !cart.ready_for_pickup && (
                          <Badge variant="default" className="bg-orange-500">En préparation</Badge>
                        )}
                        {!cart.preparation_notified_at && (
                          <Badge variant="default" className="bg-yellow-500">En attente</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-medium">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        Articles ({cart.items.length})
                      </div>
                      <div className="space-y-2">
                        {cart.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                            {item.image_url && (
                              <img src={item.image_url} alt={item.product_name} className="w-12 h-12 object-cover rounded" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.product_name}</p>
                              <p className="text-xs text-muted-foreground">{item.brand}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">x{item.quantity}</p>
                              <p className="text-sm text-muted-foreground">{item.price.toFixed(2)} €</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                      {!cart.preparation_notified_at && (
                        <Button
                          onClick={() => handleNotifyPreparation(cart.id, cart.profiles?.email, cart)}
                          className="flex-1 gap-2"
                          variant="default"
                        >
                          <Bell className="h-4 w-4" />
                          En préparation
                        </Button>
                      )}
                      {cart.preparation_notified_at && (
                        <Button
                          onClick={() => handleNotifyPreparation(cart.id, cart.profiles?.email, cart)}
                          className="flex-1 gap-2"
                          variant="secondary"
                          disabled
                        >
                          <CheckCircle className="h-4 w-4" />
                          En préparation
                        </Button>
                      )}

                      {!cart.ready_for_pickup && !cart.preparation_notified_at && (
                        <Button className="flex-1 gap-2" variant="secondary" disabled>
                          <Bell className="h-4 w-4" />
                          Prête à retirer
                        </Button>
                      )}
                      {cart.preparation_notified_at && !cart.ready_for_pickup && (
                        <Button
                          onClick={() => handleNotifyReady(cart.id, cart.profiles?.email, cart)}
                          className="flex-1 gap-2"
                          variant="default"
                        >
                          <Bell className="h-4 w-4" />
                          Prête à retirer
                        </Button>
                      )}
                      {cart.ready_for_pickup && cart.status !== 'completed' && (
                        <Button
                          onClick={() => handleNotifyReady(cart.id, cart.profiles?.email, cart)}
                          className="flex-1 gap-2"
                          variant="secondary"
                          disabled
                        >
                          <CheckCircle className="h-4 w-4" />
                          Prête à retirer
                        </Button>
                      )}

                      {!cart.ready_for_pickup && (
                        <Button className="flex-1 gap-2" variant="secondary" disabled>
                          <CheckCircle className="h-4 w-4" />
                          Commande terminée
                        </Button>
                      )}
                      {cart.ready_for_pickup && cart.status !== 'completed' && (
                        <Button
                          onClick={() => handleMarkAsPickedUp(cart.id, cart.profiles?.email, cart)}
                          className="flex-1 gap-2"
                          variant="default"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Commande terminée
                        </Button>
                      )}
                      {cart.status === 'completed' && (
                        <Button className="flex-1 gap-2" variant="secondary" disabled>
                          <CheckCircle className="h-4 w-4" />
                          Commande terminée
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PharmacyLayout>
  );
};

export default PharmacyPickupOrders;
