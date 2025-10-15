import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import QRCode from 'qrcode';

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  qr_code: string;
}

const PharmacyQRCodes = () => {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadPharmacies();
  }, []);

  const loadPharmacies = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('pharmacies')
        .select('*')
        .order('name');

      if (error) throw error;

      if (data) {
        setPharmacies(data);
        // Generate QR codes for all pharmacies
        const codes: { [key: string]: string } = {};
        for (const pharmacy of data) {
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">QR Codes des Pharmacies</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pharmacies.map((pharmacy) => (
              <Card key={pharmacy.id} className="hover:shadow-elegant transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{pharmacy.name}</CardTitle>
                  <CardDescription>
                    {pharmacy.address}<br />
                    {pharmacy.postal_code} {pharmacy.city}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {qrCodes[pharmacy.id] && (
                    <>
                      <div className="flex justify-center bg-white p-4 rounded-lg">
                        <img 
                          src={qrCodes[pharmacy.id]} 
                          alt={`QR Code pour ${pharmacy.name}`}
                          className="w-64 h-64"
                        />
                      </div>
                      <div className="text-center text-xs text-muted-foreground font-mono">
                        Code: {pharmacy.qr_code}
                      </div>
                      <Button
                        onClick={() => downloadQRCode(pharmacy)}
                        className="w-full bg-gradient-primary"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger le QR Code
                      </Button>
                    </>
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

export default PharmacyQRCodes;
