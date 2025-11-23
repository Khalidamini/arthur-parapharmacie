import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare, Tag, QrCode, MapPin, Heart, Shield, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import UserLayout from "@/layouts/UserLayout";
import PromotionSlider from "@/components/PromotionSlider";
import OnboardingTutorial from "@/components/OnboardingTutorial";
import { useCart } from "@/contexts/CartContext";
interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  valid_until: string;
  image_url?: string;
  original_price?: number;
}
const Index = () => {
  const navigate = useNavigate();
  const cart = useCart();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [currentPharmacy, setCurrentPharmacy] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isPharmacist, setIsPharmacist] = useState(false);
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
        if (user) {
          // Récupérer le nom d'utilisateur
          const { data: profileData } = await (supabase as any)
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single();
          if (profileData?.username) {
            setUsername(profileData.username);
          }

          // Vérifier si l'utilisateur est un membre de pharmacie
          const { data: roleData } = await (supabase as any)
            .from("user_roles")
            .select("id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

          setIsPharmacist(!!roleData);

          // Vérifier s'il y a une affiliation en attente
          const pendingAffiliation = localStorage.getItem("pending_pharmacy_affiliation");
          if (pendingAffiliation) {
            const { pharmacy_id, affiliation_type } = JSON.parse(pendingAffiliation);
            try {
              await (supabase as any).from("user_pharmacy_affiliation").insert({
                user_id: user.id,
                pharmacy_id,
                affiliation_type,
              });
              localStorage.removeItem("pending_pharmacy_affiliation");
            } catch (error) {
              console.error("Error creating pending affiliation:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Récupérer le nom d'utilisateur
        (supabase as any)
          .from("profiles")
          .select("username")
          .eq("id", session.user.id)
          .single()
          .then(({ data: profileData }: any) => {
            if (profileData?.username) {
              setUsername(profileData.username);
            }
          });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Charger la pharmacie sélectionnée via le contexte
    if (cart.selectedPharmacyId) {
      const loadSelectedPharmacy = async () => {
        const { data } = await (supabase as any)
          .from("pharmacies")
          .select("name")
          .eq("id", cart.selectedPharmacyId)
          .single();
        if (data) {
          setCurrentPharmacy(data.name);
          await loadPromotions(cart.selectedPharmacyId);
        }
      };
      loadSelectedPharmacy();
    }
  }, [cart.selectedPharmacyId]);
  const loadPromotions = async (pharmacyId: string) => {
    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("pharmacy_id", pharmacyId)
        .gte("valid_until", new Date().toISOString())
        .order("created_at", {
          ascending: false,
        });
      if (error) {
        console.error("Error loading promotions:", error);
        return;
      }
      setPromotions(data || []);
    } catch (error) {
      console.error("Error in loadPromotions:", error);
    }
  };
  const handleSelectPromotion = (promotion: Promotion) => {
    console.log("Promotion sélectionnée:", promotion);
  };
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center animate-pulse">
            <img src="/icon-192.png" alt="Arthur Logo" className="h-16 w-16 rounded-full" />
          </div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }
  return (
    <UserLayout user={user}>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
        <div className="max-w-3xl mx-auto px-4 text-center relative py-[34px]">
          <div className="inline-flex h-20 w-20 items-center justify-center mb-6 animate-in zoom-in duration-500 my-0 py-0">
            <img src="/icon-192.png" alt="Arthur Logo" className="h-20 w-20 rounded-full shadow-xl" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            Bonjour{username ? ` ${username}` : ""}, je suis{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">Arthur</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Votre assistant en parapharmacie.
            <br />
            {isPharmacist
              ? "Je vous aide à améliorer les conseils et la vente à vos clients."
              : "Je vous conseils et trouve les produits qui correspondent à vos besoins."}
          </p>

          {/* Pharmacie sélectionnée */}
          {currentPharmacy && (
            <div className="bg-pharmacy-referent backdrop-blur-sm border border-pharmacy-referent rounded-xl p-4 mb-8 max-w-md mx-auto">
              <div className="flex items-center gap-2 text-sm justify-center">
                <MapPin className="h-4 w-4 text-pharmacy-referent-foreground" />
                <p className="text-pharmacy-referent-foreground">
                  Pharmacie sélectionnée :{" "}
                  <span className="font-semibold text-pharmacy-referent-foreground">{currentPharmacy}</span>
                </p>
              </div>
            </div>
          )}

          {/* Slider de promotions */}
          {cart.selectedPharmacyId && promotions.length > 0 && (
            <div className="max-w-3xl mx-auto px-3 sm:px-4 mb-8">
              <PromotionSlider promotions={promotions} onSelectPromotion={handleSelectPromotion} />
            </div>
          )}

          {/* Actions principales */}
          {!isPharmacist && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-3xl mx-auto mb-8 sm:mb-12 px-4">
              <Button
                onClick={() => navigate("/chat")}
                className="w-full h-20 sm:h-24 bg-gradient-primary border-2 border-primary hover:opacity-90 transition-all group"
              >
                <div className="flex flex-col items-center gap-1 sm:gap-2">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-xs sm:text-sm text-primary-foreground">Discuter avec Arthur </span>
                </div>
              </Button>

              <Button
                onClick={() => navigate("/pharmacies")}
                variant="outline"
                className="w-full h-20 sm:h-24 border-2 hover:border-primary/50 transition-all group"
              >
                <div className="flex flex-col items-center gap-1 sm:gap-2">
                  <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-primary group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-xs sm:text-sm text-center leading-tight">Choisir pharmacie</span>
                </div>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-3xl mx-auto px-3 sm:px-4 sm:py-20 pb-24 sm:pb-28 py-[30px]">
        <div className="grid gap-6 sm:gap-8 md:grid-cols-3">
          <div className="bg-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-border shadow-md hover:shadow-lg transition-all hover:border-primary/30 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-accent flex items-center justify-center mb-3 sm:mb-4">
              <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-accent-foreground" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Conseils personnalisés</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Des recommandations adaptées à vos besoins spécifiques en parapharmacie
            </p>
          </div>

          <div className="bg-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-border shadow-md hover:shadow-lg transition-all hover:border-primary/30 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-accent flex items-center justify-center mb-3 sm:mb-4">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-accent-foreground" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Promotions exclusives</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Accédez aux offres spéciales de votre pharmacie référente
            </p>
          </div>

          <div className="bg-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-border shadow-md hover:shadow-lg transition-all hover:border-primary/30 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-accent flex items-center justify-center mb-3 sm:mb-4">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-accent-foreground" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Expertise professionnelle</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Des conseils basés sur des connaissances pharmaceutiques fiables
            </p>
          </div>
        </div>
      </section>

      {/* Onboarding Tutorial */}
      {user && <OnboardingTutorial userId={user.id} />}
    </UserLayout>
  );
};
export default Index;
