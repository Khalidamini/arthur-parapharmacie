import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft, ShoppingCart, ShoppingBag, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import Footer from '@/components/Footer';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  brand: string;
  category: string;
  image_url: string;
  stock_quantity: number;
  is_available: boolean;
}

const Shop = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyId, setPharmacyId] = useState<string>("");

  // Load selected products from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedProducts');
    if (saved) {
      setSelectedProducts(new Set(JSON.parse(saved)));
    }
  }, []);

  useEffect(() => {
    fetchPharmacyProducts();
  }, []);

  useEffect(() => {
    filterAndSortProducts();
  }, [products, searchQuery, selectedCategory, sortBy]);

  const fetchPharmacyProducts = async () => {
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
          description: "Veuillez scanner le QR code d'une pharmacie pour continuer.",
          variant: "destructive",
        });
        navigate("/scan-qr");
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
      setPharmacyId(currentPharmacyId);

      // Get products available in this pharmacy
      const { data: pharmacyProducts, error: productsError } = await supabase
        .from("pharmacy_products")
        .select(`
          stock_quantity,
          is_available,
          products (
            id,
            name,
            description,
            price,
            brand,
            category,
            image_url
          )
        `)
        .eq("pharmacy_id", currentPharmacyId)
        .eq("is_available", true);

      if (productsError) throw productsError;

      const formattedProducts = pharmacyProducts.map((pp: any) => ({
        ...pp.products,
        stock_quantity: pp.stock_quantity,
        is_available: pp.is_available,
      }));

      setProducts(formattedProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortProducts = () => {
    let filtered = [...products];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "brand":
          return a.brand.localeCompare(b.brand);
        default:
          return 0;
      }
    });

    setFilteredProducts(filtered);
  };

  const toggleProductSelection = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const isSelected = selectedProducts.has(productId);
    
    if (!isSelected) {
      // Ajouter automatiquement au panier
      try {
        await cart.addToCart({
          id: product.id,
          name: product.name,
          brand: product.brand,
          price: product.price,
          imageUrl: product.image_url || '',
          source: 'shop',
          productId: product.id,
        }, pharmacyId || cart.selectedPharmacyId || undefined);
        
        toast({
          title: "Ajouté au panier",
          description: `${product.name} ajouté au panier`,
        });
      } catch (e) {
        console.error('Error adding to cart', e);
        toast({ 
          title: 'Erreur', 
          description: 'Impossible d\'ajouter au panier', 
          variant: 'destructive' 
        });
      }
    }
  };


  const categories = Array.from(new Set(products.map((p) => p.category)));

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
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <Button variant="outline" onClick={() => navigate('/cart')}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Panier ({cart.totalItems})
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Boutique</h1>
              <p className="text-muted-foreground">{pharmacyName}</p>
            </div>
            <Button
              size="lg"
              onClick={() => navigate("/promotions")}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
            >
              <Tag className="h-5 w-5" />
              🎉 Promotions
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="price-asc">Prix croissant</SelectItem>
              <SelectItem value="price-desc">Prix décroissant</SelectItem>
              <SelectItem value="brand">Marque</SelectItem>
            </SelectContent>
          </Select>
        </div>


        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="transition-all hover:shadow-lg"
            >
              <CardHeader>
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
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
                <CardTitle className="line-clamp-2">{product.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {product.brand}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                  {product.description}
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{product.category}</Badge>
                  {product.stock_quantity > 0 && (
                    <Badge variant="outline">
                      Stock: {product.stock_quantity}
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold text-primary">
                  {product.price.toFixed(2)} €
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProductSelection(product.id);
                  }}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Ajouter au panier
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Aucun produit trouvé avec ces critères
            </p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Shop;
