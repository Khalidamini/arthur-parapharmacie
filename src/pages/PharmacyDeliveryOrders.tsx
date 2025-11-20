import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Truck, User, Calendar, Package, Search, Download, ExternalLink } from "lucide-react";
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
  delivery_method?: string;
  delivery_address?: any;
  delivery_status?: string | null;
  shipping_tracking_number?: string | null;
  shipping_label_url?: string | null;
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

const PharmacyDeliveryOrders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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
      .channel('pharmacy-delivery-orders-realtime')
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
        .eq('delivery_method', 'delivery')
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
        if (statusFilter === 'pending') return !cart.shipping_tracking_number;
        if (statusFilter === 'shipped') return cart.shipping_tracking_number && !cart.delivery_status;
        if (statusFilter === 'in_transit') return cart.delivery_status === 'in_transit';
        if (statusFilter === 'delivered') return cart.delivery_status === 'delivered' || cart.status === 'completed';
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
          cart.shipping_tracking_number?.toLowerCase().includes(searchLower)
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

  const getDeliveryStatusBadge = (cart: Cart) => {
    if (cart.status === 'completed' || cart.delivery_status === 'delivered') {
      return <Badge className="bg-green-500">Livrée</Badge>;
    }
    if (cart.delivery_status === 'in_transit') {
      return <Badge className="bg-blue-500">En cours</Badge>;
    }
    if (cart.shipping_tracking_number) {
      return <Badge className="bg-orange-500">Expédiée</Badge>;
    }
    return <Badge className="bg-yellow-500">En attente</Badge>;
  };

  const getOrderStats = () => {
    const pending = carts.filter(c => !c.shipping_tracking_number).length;
    const shipped = carts.filter(c => c.shipping_tracking_number && !c.delivery_status).length;
    const inTransit = carts.filter(c => c.delivery_status === 'in_transit').length;
    const delivered = carts.filter(c => c.delivery_status === 'delivered' || c.status === 'completed').length;

    return { pending, shipped, inTransit, delivered };
  };

  if (loading) {
    return (
      <PharmacyLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </PharmacyLayout>
    );
  }

  const stats = getOrderStats();

  return (
    <PharmacyLayout>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Livraisons à Domicile</h1>
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
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Expédiées</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{stats.shipped}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">En Transit</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{stats.inTransit}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Livrées</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{stats.delivered}</div>
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
                        <SelectItem value="shipped">Expédiées</SelectItem>
                        <SelectItem value="in_transit">En transit</SelectItem>
                        <SelectItem value="delivered">Livrées</SelectItem>
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
                <Truck className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-foreground mb-2">Aucune livraison</p>
                <p className="text-muted-foreground">Aucune commande de livraison trouvée avec ces critères.</p>
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
                        {getDeliveryStatusBadge(cart)}
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

                    {cart.delivery_address && (
                      <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                        <div className="font-medium flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Adresse de livraison
                        </div>
                        <p className="text-sm">{cart.delivery_address.name}</p>
                        <p className="text-sm">{cart.delivery_address.street}</p>
                        <p className="text-sm">
                          {cart.delivery_address.postal_code} {cart.delivery_address.city}
                        </p>
                        {cart.delivery_address.phone && (
                          <p className="text-sm">📱 {cart.delivery_address.phone}</p>
                        )}
                      </div>
                    )}

                    {cart.shipping_tracking_number && (
                      <div className="flex flex-col sm:flex-row gap-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">Numéro de suivi</p>
                          <p className="text-sm text-muted-foreground">{cart.shipping_tracking_number}</p>
                        </div>
                        <div className="flex gap-2">
                          {cart.shipping_label_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(cart.shipping_label_url!, '_blank')}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Étiquette
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`https://www.sendcloud.fr/tracking/?tracking_number=${cart.shipping_tracking_number}`, '_blank')}
                            className="gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Suivre
                          </Button>
                        </div>
                      </div>
                    )}

                    {!cart.shipping_tracking_number && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <p className="text-sm font-medium">⏳ Étiquette d'expédition en cours de génération...</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          L'étiquette sera générée automatiquement dans les prochaines minutes.
                        </p>
                      </div>
                    )}
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

export default PharmacyDeliveryOrders;
