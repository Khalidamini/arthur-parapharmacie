import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Rocket, Loader2, CheckCircle2 } from "lucide-react";

interface TurnkeySolutionContactProps {
  pharmacyId: string;
}

export default function TurnkeySolutionContact({ pharmacyId }: TurnkeySolutionContactProps) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    pharmacy_name: '',
    contact_name: '',
    phone: '',
    software_name: '',
    message: '',
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.pharmacy_name || !formData.contact_name || !formData.phone) {
      toast({
        title: "Champs requis manquants",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('contact-turnkey-solution', {
        body: {
          pharmacy_id: pharmacyId,
          ...formData,
        },
      });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Demande envoyée !",
        description: data.message,
      });
    } catch (error) {
      console.error('Error sending contact request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'envoi';
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Demande envoyée avec succès !</h3>
              <p className="text-sm text-green-700 mt-2">
                Notre équipe technique vous contactera sous 24-48h pour planifier l'installation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Solution clé en main Arthur
        </CardTitle>
        <CardDescription>
          Demandez l'installation du service de synchronisation automatique
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
            <h4 className="font-semibold mb-2">✨ Ce qui est inclus :</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Installation d'un connecteur sur votre ordinateur</li>
              <li>• Connexion directe à votre logiciel de gestion</li>
              <li>• Synchronisation automatique en temps réel</li>
              <li>• Support technique dédié</li>
              <li>• Maintenance et mises à jour incluses</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pharmacy_name">
              Nom de la pharmacie <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pharmacy_name"
              value={formData.pharmacy_name}
              onChange={(e) => setFormData({ ...formData, pharmacy_name: e.target.value })}
              placeholder="Pharmacie du Centre"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_name">
              Nom du contact <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              placeholder="Dr. Martin Dupont"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Téléphone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="01 23 45 67 89"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="software_name">Logiciel de gestion (optionnel)</Label>
            <Input
              id="software_name"
              value={formData.software_name}
              onChange={(e) => setFormData({ ...formData, software_name: e.target.value })}
              placeholder="Ex: Pharmagest, LGPI, Winpharma..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message complémentaire (optionnel)</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Informations supplémentaires, questions particulières..."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Demander un devis
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            En soumettant ce formulaire, vous acceptez d'être contacté par notre équipe technique.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
