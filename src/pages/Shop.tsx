import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft, ShoppingCart, ShoppingBag } from "lucide-react";
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

      // Get user's affiliated pharmacy
      const { data: affiliation, error: affiliationError } = await supabase
        .from("user_pharmacy_affiliation")
        .select("pharmacy_id, pharmacies(name)")
        .eq("user_id", user.id)
        .single();

      if (affiliationError || !affiliation) {
        toast({
          title: "Aucune pharmacie affiliée",
          description: "Veuillez scanner le QR code d'une pharmacie pour continuer.",
          variant: "destructive",
        });
        navigate("/scan-qr");
        return;
      }

      setPharmacyName(affiliation.pharmacies.name);

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
        .eq("pharmacy_id", affiliation.pharmacy_id)
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

  const toggleProductSelection = (productId: string) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
    // Save to localStorage
    localStorage.setItem('selectedProducts', JSON.stringify(Array.from(newSelection)));
  };

  const addSelectedToCart = async () => {
    if (selectedProducts.size === 0) {
      toast({
        title: "Panier vide",
        description: "Veuillez sélectionner au moins un produit",
        variant: "destructive",
      });
      return;
    }

    const toAdd = Array.from(selectedProducts)
      .map(id => products.find(p => p.id === id))
      .filter((p): p is Product => Boolean(p));

    try {
      await Promise.all(
        toAdd.map(p =>
          cart.addToCart({
            id: p.id,
            name: p.name,
            brand: p.brand,
            price: p.price,
            imageUrl: p.image_url || '',
            source: 'shop',
            productId: p.id,
          })
        )
      );

      toast({
        title: "Produits ajoutés",
        description: `${toAdd.length} produit(s) ajouté(s) au panier`,
      });

      setSelectedProducts(new Set());
      localStorage.removeItem('selectedProducts');
      navigate('/cart');
    } catch (e) {
      console.error('Error adding selected products to cart', e);
      toast({ title: 'Erreur', description: 'Impossible d\'ajouter au panier', variant: 'destructive' });
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <Button variant="outline" onClick={() => {
              if (selectedProducts.size > 0) {
                addSelectedToCart();
              } else {
                navigate('/cart');
              }
            }}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Panier ({selectedProducts.size})
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Boutique</h1>
          <p className="text-muted-foreground">{pharmacyName}</p>
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

        {/* Selected Products Info */}
        {selectedProducts.size > 0 && (
          <div className="mb-4 p-4 bg-primary/10 rounded-lg flex items-center justify-between">
            <p className="font-medium">
              {selectedProducts.size} produit(s) sélectionné(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedProducts(new Set());
                  localStorage.removeItem('selectedProducts');
                }}
              >
                Désélectionner tout
              </Button>
              <Button size="sm" onClick={addSelectedToCart}>
                Ajouter au panier
              </Button>
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedProducts.has(product.id) ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => toggleProductSelection(product.id)}
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
                  variant={selectedProducts.has(product.id) ? "default" : "outline"}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {selectedProducts.has(product.id) ? "Sélectionné" : "Sélectionner"}
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
