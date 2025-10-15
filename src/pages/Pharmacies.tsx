import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Navigation, Phone, Mail, Download, QrCode as QrCodeIcon, MapPin, Star, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import QRCode from 'qrcode';
import Footer from '@/components/Footer';

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone?: string;
  email?: string;
  latitude: number;
  longitude: number;
  qr_code: string;
  distance?: number;
}

const Pharmacies = () => {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});
  const [expandedQR, setExpandedQR] = useState<string | null>(null);
  const [currentPharmacyId, setCurrentPharmacyId] = useState<string | null>(null);
  const [settingPharmacy, setSettingPharmacy] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'city' | 'name'>('distance');
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadPharmacies();
    getUserLocation();
    loadCurrentPharmacy();
  }, []);

  const loadCurrentPharmacy = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await (supabase as any)
        .from('user_pharmacy_affiliation')
        .select('pharmacy_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setCurrentPharmacyId(data.pharmacy_id);
      }
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const loadPharmacies = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('pharmacies')
        .select('*')
        .order('name');

      if (error) throw error;

      if (data) {
        let pharmaciesWithDistance = data.map((p: any) => ({
          ...p,
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude)
        }));

        if (userLocation) {
          pharmaciesWithDistance = pharmaciesWithDistance.map((p: any) => ({
            ...p,
            distance: calculateDistance(
              userLocation.lat,
              userLocation.lng,
              p.latitude,
              p.longitude
            )
          }));
        }

        setPharmacies(pharmaciesWithDistance as Pharmacy[]);
        
        // Generate QR codes that open the auth page directly
        const codes: { [key: string]: string } = {};
        for (const pharmacy of pharmaciesWithDistance) {
          try {
            const targetUrl = `${window.location.origin}/auth?code=${encodeURIComponent(pharmacy.qr_code)}`;
            const qrDataUrl = await QRCode.toDataURL(targetUrl, {
              width: 300,
              margin: 2,
            });
            codes[pharmacy.id] = qrDataUrl;
          } catch (err) {
            console.error('Error generating QR code:', err);
          }
        }
        setQrCodes(codes);
      }
    } catch (error) {
      console.error('Error loading pharmacies:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les pharmacies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = (pharmacy: Pharmacy) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.latitude},${pharmacy.longitude}`;
    window.open(url, '_blank');
  };

  const downloadQRCode = (pharmacy: Pharmacy) => {
    const qrDataUrl = qrCodes[pharmacy.id];
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr-${pharmacy.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const setAsReferencePharmacy = async (pharmacy: Pharmacy) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Non connecté",
        description: "Vous devez être connecté pour définir une pharmacie référente",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    setSettingPharmacy(pharmacy.id);
    try {
      // Vérifier si l'utilisateur a déjà une affiliation
      const { data: existingAffiliation } = await (supabase as any)
        .from('user_pharmacy_affiliation')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingAffiliation) {
        // Mettre à jour l'affiliation existante
        const { error } = await (supabase as any)
          .from('user_pharmacy_affiliation')
          .update({
            pharmacy_id: pharmacy.id,
            affiliation_type: 'permanent',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Créer une nouvelle affiliation
        const { error } = await (supabase as any)
          .from('user_pharmacy_affiliation')
          .insert({
            user_id: user.id,
            pharmacy_id: pharmacy.id,
            affiliation_type: 'permanent'
          });

        if (error) throw error;
      }

      setCurrentPharmacyId(pharmacy.id);
      toast({
        title: "Pharmacie référente définie",
        description: `${pharmacy.name} est maintenant votre pharmacie référente`,
      });
    } catch (error) {
      console.error('Error setting reference pharmacy:', error);
      toast({
        title: "Erreur",
        description: "Impossible de définir la pharmacie référente",
        variant: "destructive",
      });
    } finally {
      setSettingPharmacy(null);
    }
  };

  const sortedPharmacies = [...pharmacies].sort((a, b) => {
    switch (sortBy) {
      case 'distance':
        if (!a.distance && !b.distance) return 0;
        if (!a.distance) return 1;
        if (!b.distance) return -1;
        return a.distance - b.distance;
      case 'city':
        return a.city.localeCompare(b.city);
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground flex-1">Pharmacies affiliées</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Trier
            </Button>
          </div>
          
          {showFilters && (
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-4">
                <Label className="text-sm font-medium mb-3 block">Trier par</Label>
                <RadioGroup value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="distance" id="distance" />
                    <Label htmlFor="distance" className="font-normal cursor-pointer">
                      Plus proche de moi {!userLocation && '(localisation désactivée)'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="city" id="city" />
                    <Label htmlFor="city" className="font-normal cursor-pointer">
                      Par ville
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="name" id="name" />
                    <Label htmlFor="name" className="font-normal cursor-pointer">
                      Par nom
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedPharmacies.map((pharmacy) => (
              <Card key={pharmacy.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{pharmacy.name}</CardTitle>
                      {pharmacy.distance && (
                        <p className="text-sm text-primary font-medium">
                          À {pharmacy.distance.toFixed(1)} km
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="text-muted-foreground">
                      <p>{pharmacy.address}</p>
                      <p>{pharmacy.postal_code} {pharmacy.city}</p>
                    </div>
                  </div>
                  {pharmacy.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{pharmacy.phone}</span>
                    </div>
                  )}
                  {pharmacy.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{pharmacy.email}</span>
                    </div>
                  )}

                  {currentPharmacyId === pharmacy.id && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 mb-3">
                      <Star className="h-4 w-4 text-primary fill-primary" />
                      <span className="text-sm font-medium text-primary">Pharmacie référente</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {currentPharmacyId !== pharmacy.id && (
                      <Button
                        size="sm"
                        onClick={() => setAsReferencePharmacy(pharmacy)}
                        disabled={settingPharmacy === pharmacy.id}
                        className="w-full bg-gradient-primary"
                      >
                        <Star className="h-4 w-4 mr-2" />
                        {settingPharmacy === pharmacy.id ? 'Définition...' : 'Définir comme pharmacie référente'}
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedQR(expandedQR === pharmacy.id ? null : pharmacy.id)}
                        className="flex-1"
                      >
                        <QrCodeIcon className="h-4 w-4 mr-2" />
                        {expandedQR === pharmacy.id ? 'Masquer QR' : 'Voir QR Code'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openInMaps(pharmacy)}
                        className="flex-1"
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Itinéraire
                      </Button>
                    </div>
                  </div>

                  {expandedQR === pharmacy.id && qrCodes[pharmacy.id] && (
                    <div className="mt-4 space-y-3 pt-4 border-t border-border">
                      <div className="flex justify-center bg-white p-4 rounded-lg">
                        <img 
                          src={qrCodes[pharmacy.id]} 
                          alt={`QR Code pour ${pharmacy.name}`}
                          className="w-48 h-48"
                        />
                      </div>
                      <div className="text-center text-xs text-muted-foreground font-mono">
                        Code: {pharmacy.qr_code}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadQRCode(pharmacy)}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger le QR Code
                      </Button>
                    </div>
                  )}
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

export default Pharmacies;
