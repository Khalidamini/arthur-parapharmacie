import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft, Tag, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import Footer from '@/components/Footer';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  valid_until: string;
  image_url: string;
  original_price: number;
  product_id: string;
  products?: {
    name: string;
    brand: string;
    category: string;
  };
}

const Promotions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const cart = useCart();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [filteredPromotions, setFilteredPromotions] = useState<Promotion[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("discount");
  const [loading, setLoading] = useState(true);
  const [pharmacyName, setPharmacyName] = useState("");

  useEffect(() => {
    fetchPromotions();
  }, []);

  useEffect(() => {
    filterAndSortPromotions();
  }, [promotions, searchQuery, sortBy]);

  const fetchPromotions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Utiliser la pharmacie sélectionnée du contexte
      const currentPharmacyId = cart.selectedPharmacyId;
      if (!currentPharmacyId) {
        toast({
          title: "Aucune pharmacie affiliée",
          description: "Veuillez sélectionner une pharmacie pour voir les promotions.",
          variant: "destructive",
        });
        navigate("/pharmacies");
        return;
      }

      // Get pharmacy details
      const { data: pharmacy, error: pharmacyError } = await supabase
        .from("pharmacies")
        .select("name")
        .eq("id", currentPharmacyId)
        .single();

      if (pharmacyError || !pharmacy) {
        toast({
          title: "Erreur",
          description: "Impossible de charger la pharmacie.",
          variant: "destructive",
        });
        return;
      }

      setPharmacyName(pharmacy.name);

      // Get promotions for this pharmacy with product details
      const { data: promotionsData, error: promotionsError } = await supabase
        .from("promotions")
        .select(`
          *,
          products (
            name,
            brand,
            category
          )
        `)
        .eq("pharmacy_id", currentPharmacyId)
        .order("created_at", { ascending: false });

      if (promotionsError) throw promotionsError;

      setPromotions(promotionsData || []);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les promotions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPromotions = () => {
    let filtered = [...promotions];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.products?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.products?.brand.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "discount":
          return (b.discount_percentage || 0) - (a.discount_percentage || 0);
        case "price-asc":
          return (a.original_price || 0) - (b.original_price || 0);
        case "price-desc":
          return (b.original_price || 0) - (a.original_price || 0);
        case "expiry":
          if (!a.valid_until) return 1;
          if (!b.valid_until) return -1;
          return new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime();
        default:
          return 0;
      }
    });

    setFilteredPromotions(filtered);
  };

  const calculateDiscountedPrice = (originalPrice: number, discount: number) => {
    return originalPrice * (1 - discount / 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => navigate("/shop")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la boutique
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Promotions</h1>
          <p className="text-muted-foreground">{pharmacyName}</p>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une promotion..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="discount">Réduction (plus élevée)</SelectItem>
              <SelectItem value="price-asc">Prix croissant</SelectItem>
              <SelectItem value="price-desc">Prix décroissant</SelectItem>
              <SelectItem value="expiry">Date d'expiration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Promotions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPromotions.map((promotion) => (
            <Card
              key={promotion.id}
              className="transition-all hover:shadow-lg relative overflow-hidden"
            >
              {promotion.discount_percentage && (
                <div className="absolute top-4 right-4 z-10">
                  <Badge variant="destructive" className="text-lg font-bold">
                    -{promotion.discount_percentage}%
                  </Badge>
                </div>
              )}
              <CardHeader>
                {promotion.image_url && (
                  <img
                    src={promotion.image_url}
                    alt={promotion.title}
                    className="w-full h-48 object-cover rounded-md mb-4"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                )}
                <CardTitle className="line-clamp-2">{promotion.title}</CardTitle>
                {promotion.products && (
                  <CardDescription className="line-clamp-1">
                    {promotion.products.brand} - {promotion.products.name}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {promotion.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {promotion.description}
                  </p>
                )}
                {promotion.products?.category && (
                  <Badge variant="secondary" className="mb-3">
                    {promotion.products.category}
                  </Badge>
                )}
                {promotion.valid_until && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Valable jusqu'au {format(new Date(promotion.valid_until), "dd MMMM yyyy", { locale: fr })}
                    </span>
                  </div>
                )}
                {promotion.original_price && (
                  <div className="space-y-1">
                    <p className="text-sm line-through text-muted-foreground">
                      {promotion.original_price.toFixed(2)} €
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {calculateDiscountedPrice(promotion.original_price, promotion.discount_percentage).toFixed(2)} €
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => navigate("/shop")}
                >
                  <Tag className="mr-2 h-4 w-4" />
                  Voir en boutique
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredPromotions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Aucune promotion trouvée avec ces critères
            </p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Promotions;
