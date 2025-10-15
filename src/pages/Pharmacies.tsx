import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Navigation, Phone, Mail, Download, QrCode as QrCodeIcon, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import QRCode from 'qrcode';

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
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadPharmacies();
    getUserLocation();
  }, []);

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
          pharmaciesWithDistance.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
        }

        setPharmacies(pharmaciesWithDistance as Pharmacy[]);
        
        // Generate QR codes for all pharmacies
        const codes: { [key: string]: string } = {};
        for (const pharmacy of pharmaciesWithDistance) {
          try {
            const qrDataUrl = await QRCode.toDataURL(pharmacy.qr_code, {
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

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Pharmacies affiliées</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {pharmacies.map((pharmacy) => (
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

                  <div className="flex gap-2 mt-4">
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
                      size="sm"
                      onClick={() => openInMaps(pharmacy)}
                      className="flex-1 bg-gradient-primary"
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Itinéraire
                    </Button>
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
    </div>
  );
};

export default Pharmacies;
