import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePharmacyActivityLog } from "@/hooks/usePharmacyActivityLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
const PharmacyOrders = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    logActivity
  } = usePharmacyActivityLog();
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
    filterAndSortCarts();
  }, [carts, statusFilter, searchQuery, sortBy]);
  const checkAuthAndLoadData = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        navigate('/pharmacy-login');
        return;
      }

      // Récupérer le rôle et la pharmacie de l'utilisateur
      const {
        data: roleData,
        error: roleError
      } = await supabase.from('user_roles').select('pharmacy_id, pharmacies(name)').eq('user_id', user.id).maybeSingle();
      if (roleError || !roleData) {
        toast({
          title: "Accès non autorisé",
          description: "Vous n'avez pas les permissions nécessaires.",
          variant: "destructive"
        });
        navigate('/');
        return;
      }
      setPharmacyId(roleData.pharmacy_id);
      setPharmacyName((roleData.pharmacies as any)?.name || '');
      await loadCarts(roleData.pharmacy_id);
    } catch (error) {
      console.error('Error checking auth:', error);
      navigate('/pharmacy-login');
    } finally {
      setLoading(false);
    }
  };
  const loadCarts = async (pharmId: string) => {
    try {
      // Charger tous les paniers de cette pharmacie
      const {
        data: cartsData,
        error: cartsError
      } = await supabase.from('carts').select(`
          id,
          user_id,
          status,
          payment_status,
          created_at,
          updated_at,
          completed_at,
          ready_for_pickup,
          notification_sent_at,
          pickup_message
        `).eq('pharmacy_id', pharmId).order('created_at', {
        ascending: false
      });
      if (cartsError) throw cartsError;

      // Charger les items de tous ces paniers
      const cartIds = cartsData?.map(c => c.id) || [];
      const {
        data: itemsData,
        error: itemsError
      } = await supabase.from('cart_items').select('*').in('cart_id', cartIds);
      if (itemsError) throw itemsError;

      // Charger les profils des utilisateurs
      const userIds = [...new Set(cartsData?.map(c => c.user_id) || [])];
      const {
        data: profilesData
      } = await supabase.from('profiles').select('id, email, qr_code_number, username, first_name, last_name, phone').in('id', userIds);

      // Organiser les données
      const cartsWithItems: Cart[] = (cartsData || []).map(cart => ({
        ...cart,
        items: (itemsData || []).filter(item => item.cart_id === cart.id),
        profiles: profilesData?.find(p => p.id === cart.user_id)
      }));
      setCarts(cartsWithItems);
    } catch (error) {
      console.error('Error loading carts:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les paniers.",
        variant: "destructive"
      });
    }
  };
  const filterAndSortCarts = () => {
    let filtered = [...carts];

    // Filtrer par statut
    if (statusFilter === 'paid') {
      filtered = filtered.filter(c => c.payment_status === 'paid');
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Filtrer par recherche (ID client, email ou nom)
    if (searchQuery) {
      filtered = filtered.filter(c => {
        const email = c.profiles?.email?.toLowerCase() || '';
        const qrCode = c.profiles?.qr_code_number?.toLowerCase() || '';
        const userId = c.user_id.toLowerCase();
        const firstName = c.profiles?.first_name?.toLowerCase() || '';
        const lastName = c.profiles?.last_name?.toLowerCase() || '';
        const username = c.profiles?.username?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        return email.includes(query) || qrCode.includes(query) || userId.includes(query) || firstName.includes(query) || lastName.includes(query) || username.includes(query);
      });
    }

    // Trier
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'total-desc':
          const totalA = a.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const totalB = b.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          return totalB - totalA;
        case 'total-asc':
          const totalA2 = a.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const totalB2 = b.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          return totalA2 - totalB2;
        default:
          return 0;
      }
    });
    setFilteredCarts(filtered);
  };
  const handleNotifyPreparation = async (cartId: string, cart: Cart) => {
    try {
      const {
        error
      } = await supabase.functions.invoke('notify-customer-order-preparation', {
        body: {
          cartId
        }
      });
      if (error) throw error;
      toast({
        title: "Notification envoyée",
        description: "Le client a été notifié que sa commande est en préparation."
      });
      if (pharmacyId) {
        const customerName = cart.profiles?.first_name && cart.profiles?.last_name ? `${cart.profiles.first_name} ${cart.profiles.last_name}` : cart.profiles?.email || cart.profiles?.qr_code_number || 'Client inconnu';
        await logActivity({
          pharmacyId,
          actionType: 'order_preparation_notification_sent',
          actionDetails: {
            cart_id: cartId,
            customer_name: customerName,
            total_amount: cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
          },
          entityType: 'cart',
          entityId: cartId
        });
        await loadCarts(pharmacyId);
      }
    } catch (error) {
      console.error('Error notifying customer:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la notification.",
        variant: "destructive"
      });
    }
  };
  const handleNotifyReady = async (cartId: string, cart: Cart) => {
    try {
      const {
        error
      } = await supabase.functions.invoke('notify-customer-order-ready', {
        body: {
          cartId
        }
      });
      if (error) throw error;
      toast({
        title: "Notification envoyée",
        description: "Le client a été notifié que sa commande est prête."
      });
      if (pharmacyId) {
        const customerName = cart.profiles?.first_name && cart.profiles?.last_name ? `${cart.profiles.first_name} ${cart.profiles.last_name}` : cart.profiles?.email || cart.profiles?.qr_code_number || 'Client inconnu';
        await logActivity({
          pharmacyId,
          actionType: 'order_ready_notification_sent',
          actionDetails: {
            cart_id: cartId,
            customer_name: customerName,
            total_amount: cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
          },
          entityType: 'cart',
          entityId: cartId
        });
        await loadCarts(pharmacyId);
      }
    } catch (error) {
      console.error('Error notifying customer:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la notification.",
        variant: "destructive"
      });
    }
  };
  const handleMarkAsPickedUp = async (cartId: string, cart: Cart) => {
    try {
      // Send pickup confirmation email
      const {
        error: emailError
      } = await supabase.functions.invoke('notify-customer-order-picked-up', {
        body: {
          cartId
        }
      });
      if (emailError) {
        console.error('Error sending pickup confirmation:', emailError);
      }

      // Update cart status
      const {
        error
      } = await supabase.from('carts').update({
        status: 'completed',
        ready_for_pickup: false
      }).eq('id', cartId);
      if (error) throw error;
      toast({
        title: "Commande marquée comme retirée",
        description: "La commande a été marquée comme retirée et le client a été notifié par email."
      });

      // Log activity
      if (pharmacyId) {
        const customerName = cart.profiles?.first_name && cart.profiles?.last_name ? `${cart.profiles.first_name} ${cart.profiles.last_name}` : cart.profiles?.email || cart.profiles?.qr_code_number || 'Client inconnu';
        await logActivity({
          pharmacyId,
          actionType: 'order_picked_up',
          actionDetails: {
            cart_id: cartId,
            customer_name: customerName,
            total_amount: cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
          },
          entityType: 'cart',
          entityId: cartId
        });
        await loadCarts(pharmacyId);
      }
    } catch (error) {
      console.error('Error marking as picked up:', error);
      toast({
        title: "Erreur",
        description: "Impossible de marquer la commande comme retirée.",
        variant: "destructive"
      });
    }
  };
  const renderCart = (cart: Cart) => {
    const total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const arthurItems = cart.items.filter(item => item.source === 'arthur');
    const shopItems = cart.items.filter(item => item.source === 'shop');
    const promoItems = cart.items.filter(item => item.source === 'promotion');
    const isPaid = cart.payment_status === 'paid';
    return <Card key={cart.id} className="mb-4">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {cart.profiles?.first_name && cart.profiles?.last_name ? `${cart.profiles.first_name} ${cart.profiles.last_name}` : cart.profiles?.username || cart.profiles?.email || `Client ${cart.profiles?.qr_code_number || 'Inconnu'}`}
              </CardTitle>
              
              {/* Coordonnées du client */}
              <div className="space-y-1 text-sm bg-muted/30 p-3 rounded-lg">
                {cart.profiles?.email && <div className="flex items-center gap-2">
                    <span className="font-medium">Email:</span>
                    <a href={`mailto:${cart.profiles.email}`} className="text-primary hover:underline">
                      {cart.profiles.email}
                    </a>
                  </div>}
                {cart.profiles?.phone && <div className="flex items-center gap-2">
                    <span className="font-medium">Tél:</span>
                    <a href={`tel:${cart.profiles.phone}`} className="text-primary hover:underline">
                      {cart.profiles.phone}
                    </a>
                  </div>}
                {!cart.profiles?.email && !cart.profiles?.phone && <p className="text-muted-foreground italic">Aucune coordonnée disponible</p>}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(cart.created_at), "d MMMM yyyy 'à' HH:mm", {
                locale: fr
              })}
              </div>
              {cart.completed_at && <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Payé le {format(new Date(cart.completed_at), "d MMMM yyyy 'à' HH:mm", {
                locale: fr
              })}
                </div>}
              {cart.notification_sent_at && <div className="flex items-center gap-2 text-sm text-success">
                  <Bell className="h-3 w-3" />
                  Client notifié le {format(new Date(cart.notification_sent_at), "d MMMM yyyy 'à' HH:mm", {
                locale: fr
              })}
                </div>}
            </div>
            <div className="text-right space-y-2">
              <div className="flex gap-2 justify-end">
                <Badge variant={isPaid ? 'default' : 'outline'}>
                  {isPaid ? '✓ Payé' : 'Non payé'}
                </Badge>
                {cart.ready_for_pickup && <Badge variant="secondary">
                    Prêt
                  </Badge>}
              </div>
              <p className="text-2xl font-bold text-primary">
                {total.toFixed(2)} €
              </p>
              {isPaid && <div className="space-y-2">
                  <Button size="sm" onClick={() => handleNotifyPreparation(cart.id, cart)} className="w-full" variant={cart.preparation_notified_at ? "secondary" : "default"} style={cart.preparation_notified_at ? {
                backgroundColor: '#3b82f6',
                color: 'white'
              } : {
                backgroundColor: '#22c55e',
                color: 'white'
              }} disabled={!!cart.preparation_notified_at}>
                    <Bell className="mr-2 h-4 w-4" />
                    En préparation
                  </Button>
                  
                  <Button size="sm" onClick={() => handleNotifyReady(cart.id, cart)} className="w-full" variant={cart.notification_sent_at ? "secondary" : "default"} style={cart.notification_sent_at ? {
                backgroundColor: '#3b82f6',
                color: 'white'
              } : {
                backgroundColor: '#22c55e',
                color: 'white'
              }} disabled={!cart.preparation_notified_at || !!cart.notification_sent_at}>
                    <Package className="mr-2 h-4 w-4" />
                    Prête à retirer
                  </Button>
                  
                  <Button size="sm" onClick={() => handleMarkAsPickedUp(cart.id, cart)} className="w-full" variant={cart.status === 'completed' ? "secondary" : "default"} style={cart.status === 'completed' ? {
                backgroundColor: '#3b82f6',
                color: 'white'
              } : {
                backgroundColor: '#22c55e',
                color: 'white'
              }} disabled={!cart.notification_sent_at || cart.status === 'completed'}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Commande terminée
                  </Button>
                </div>}
              {cart.status === 'completed'}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Produits recommandés par Arthur */}
            {arthurItems.length > 0 && <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10">IA</Badge>
                  Recommandés par Arthur ({arthurItems.length})
                </h4>
                <div className="space-y-2">
                  {arthurItems.map(item => <div key={item.id} className="flex items-center justify-between p-2 bg-primary/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.image_url && <img src={item.image_url} alt={item.product_name} className="w-12 h-12 object-cover rounded" onError={e => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder.svg';
                  }} />}
                        <div>
                          <p className="font-medium text-sm">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{item.brand}</p>
                          {item.reason && <p className="text-xs text-muted-foreground italic mt-1">💡 {item.reason}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">x{item.quantity}</p>
                        <p className="font-medium">{(item.price * item.quantity).toFixed(2)} €</p>
                      </div>
                    </div>)}
                </div>
              </div>}

            {/* Produits de la boutique */}
            {shopItems.length > 0 && <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  De la boutique ({shopItems.length})
                </h4>
                <div className="space-y-2">
                  {shopItems.map(item => <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.image_url && <img src={item.image_url} alt={item.product_name} className="w-12 h-12 object-cover rounded" onError={e => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder.svg';
                  }} />}
                        <div>
                          <p className="font-medium text-sm">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{item.brand}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">x{item.quantity}</p>
                        <p className="font-medium">{(item.price * item.quantity).toFixed(2)} €</p>
                      </div>
                    </div>)}
                </div>
              </div>}

            {/* Produits des promotions */}
            {promoItems.length > 0 && <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-500/10">🏷️</Badge>
                  Des promotions ({promoItems.length})
                </h4>
                <div className="space-y-2">
                  {promoItems.map(item => <div key={item.id} className="flex items-center justify-between p-2 bg-amber-500/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.image_url && <img src={item.image_url} alt={item.product_name} className="w-12 h-12 object-cover rounded" onError={e => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder.svg';
                  }} />}
                        <div>
                          <p className="font-medium text-sm">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{item.brand}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">x{item.quantity}</p>
                        <p className="font-medium">{(item.price * item.quantity).toFixed(2)} €</p>
                      </div>
                    </div>)}
                </div>
              </div>}
          </div>
        </CardContent>
      </Card>;
  };
  if (loading) {
    return <PharmacyLayout pharmacyName={pharmacyName}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        </div>
      </PharmacyLayout>;
  }
  return <PharmacyLayout pharmacyName={pharmacyName}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/pharmacy-dashboard')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour au tableau de bord
          </Button>
          
          <div className="flex items-center gap-3 mb-4">
            <ShoppingBag className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Gestion des commandes</h1>
              <p className="text-muted-foreground">{carts.length} panier(s) au total</p>
            </div>
          </div>

          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, email ou ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Date (plus récent)</SelectItem>
                <SelectItem value="date-asc">Date (plus ancien)</SelectItem>
                <SelectItem value="total-desc">Montant (décroissant)</SelectItem>
                <SelectItem value="total-asc">Montant (croissant)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="paid">Payées</SelectItem>
                <SelectItem value="active">En cours</SelectItem>
                <SelectItem value="completed">Commandes retirées</SelectItem>
                <SelectItem value="cancelled">Abandonnés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paniers en cours</p>
                  <p className="text-2xl font-bold">
                    {carts.filter(c => c.status === 'active').length}
                  </p>
                </div>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  En cours
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Commandes payées</p>
                  <p className="text-2xl font-bold">
                    {carts.filter(c => c.payment_status === 'paid').length}
                  </p>
                </div>
                <Badge variant="default" className="text-lg px-3 py-1">
                  Payées
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paniers abandonnés</p>
                  <p className="text-2xl font-bold">
                    {carts.filter(c => c.status === 'cancelled').length}
                  </p>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  Abandonnés
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des paniers */}
        <div>
          {filteredCarts.length === 0 ? <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">
                  Aucun panier trouvé avec ces critères
                </p>
              </CardContent>
            </Card> : filteredCarts.map(cart => renderCart(cart))}
        </div>
      </div>
    </PharmacyLayout>;
};
export default PharmacyOrders;