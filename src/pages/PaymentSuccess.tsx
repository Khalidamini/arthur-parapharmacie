import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loadCarts } = useCart();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-cart-payment', {
        body: { sessionId }
      });

      if (error) throw error;

      if (data?.success) {
        setVerified(true);
        // Reload carts to update status
        await loadCarts();
      }
    } catch (error) {
      console.error('Payment verification error:', error);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {verifying ? (
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            ) : (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
          </div>
          <CardTitle className="text-2xl text-center">
            {verifying ? 'Vérification du paiement...' : 'Paiement réussi !'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {!verifying && (
            <>
              <p className="text-muted-foreground">
                Votre commande a été payée avec succès. Vous pouvez maintenant la retirer à la pharmacie.
              </p>
              <p className="text-sm text-muted-foreground">
                Un email de confirmation vous a été envoyé.
              </p>
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => navigate('/cart')} 
                  variant="outline"
                  className="flex-1"
                >
                  Voir l'historique
                </Button>
                <Button 
                  onClick={() => navigate('/')} 
                  className="flex-1 bg-gradient-primary"
                >
                  Retour à l'accueil
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
