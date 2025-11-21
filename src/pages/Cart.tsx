import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, Building2, Clock, Check, TrendingDown, Package } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import Footer from '@/components/Footer';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Cart() {
  const navigate = useNavigate();
  const { activeCarts, cartHistory, updateQuantity, removeFromCart, clearCart, deleteCart, completeCart, loadCarts, selectedPharmacyId } = useCart();

  useEffect(() => {
    loadCarts();
  }, [selectedPharmacyId]);

  const filteredActiveCarts = selectedPharmacyId 
    ? activeCarts.filter(cart => cart.pharmacyId === selectedPharmacyId)
    : [];
  const filteredHistory = selectedPharmacyId
    ? cartHistory.filter(cart => cart.pharmacyId === selectedPharmacyId).sort((a, b) => 
        new Date(b.completedAt || b.updatedAt).getTime() - new Date(a.completedAt || a.updatedAt).getTime()
      )
    : [];

  // Calculer les statistiques globales des paniers actifs
  const totalItemsCount = filteredActiveCarts.reduce((sum, cart) => 
    sum + cart.items.reduce((s, item) => s + item.quantity, 0), 0
  );
  const arthurTotal = filteredActiveCarts.reduce((sum, cart) => 
    sum + cart.items.filter(item => item.source === 'arthur').reduce((s, item) => s + item.price * item.quantity, 0), 0
  );
  const shopTotal = filteredActiveCarts.reduce((sum, cart) => 
    sum + cart.items.filter(item => item.source === 'shop').reduce((s, item) => s + item.price * item.quantity, 0), 0
  );
  const grandTotal = arthurTotal + shopTotal;

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

  const renderCart = (cart: any, isActive: boolean = true) => {
    const cartTotal = cart.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    const arthurItems = cart.items.filter((item: any) => item.source === 'arthur');
    const shopItems = cart.items.filter((item: any) => item.source === 'shop');
    const promoItems = cart.items.filter((item: any) => item.source === 'promotion');

    return (
      <Card key={cart.id} className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {cart.pharmacyName || 'Panier général'}
              </CardTitle>
              {!isActive && (
                <Badge variant={cart.status === 'completed' ? 'default' : 'secondary'}>
                  {cart.status === 'completed' ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Validé
                    </>
                  ) : (
                    'Annulé'
                  )}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteCart(cart.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          {!isActive && cart.completedAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Clock className="h-4 w-4" />
              {format(new Date(cart.completedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {renderCartItems(cart)}
          
          <Separator className="my-4" />
          
          <div className="space-y-2">
            {arthurItems.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Badge variant="outline" className="bg-primary/10 text-xs">Arthur</Badge>
                  ({arthurItems.reduce((sum: number, item: any) => sum + item.quantity, 0)})
                </span>
                <span>{arthurItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
              </div>
            )}
            {shopItems.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">Boutique</Badge>
                  ({shopItems.reduce((sum: number, item: any) => sum + item.quantity, 0)})
                </span>
                <span>{shopItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
              </div>
            )}
            {promoItems.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Badge variant="outline" className="bg-orange-100 text-xs">Promos</Badge>
                  ({promoItems.reduce((sum: number, item: any) => sum + item.quantity, 0)})
                </span>
                <span>{promoItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{cartTotal.toFixed(2)} €</span>
            </div>
          </div>

          {isActive && (
            <Button 
              className="w-full mt-4 bg-gradient-primary" 
              onClick={() => navigate(`/checkout/${cart.id}`)}
            >
              Payer en ligne
            </Button>
          )}
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
            <h1 className="text-3xl font-bold">Mes Paniers</h1>
          </div>
        </div>

        {/* Résumé global */}
        {filteredActiveCarts.length > 0 && (
          <Card className="mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Résumé de vos paniers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-background/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Articles</p>
                  <p className="text-2xl font-bold text-primary">{totalItemsCount}</p>
                </div>
                {arthurTotal > 0 && (
                  <div className="text-center p-3 bg-background/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total Arthur</p>
                    <p className="text-2xl font-bold">{arthurTotal.toFixed(2)} €</p>
                  </div>
                )}
                <div className="text-center p-3 bg-background/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total Boutique</p>
                  <p className="text-2xl font-bold">{shopTotal.toFixed(2)} €</p>
                </div>
                <div className="text-center p-3 bg-primary text-primary-foreground rounded-lg">
                  <p className="text-sm mb-1 opacity-90">Total Général</p>
                  <p className="text-2xl font-bold">{grandTotal.toFixed(2)} €</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="active">
              Paniers actifs ({filteredActiveCarts.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              Historique ({filteredHistory.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
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
              filteredActiveCarts.map(cart => renderCart(cart, true))
            )}
          </TabsContent>

          <TabsContent value="history">
            {filteredHistory.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">
                    Aucun historique
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredHistory.map(cart => renderCart(cart, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}
