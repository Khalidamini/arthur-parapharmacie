import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Mail, CheckCircle } from "lucide-react";
import Footer from '@/components/Footer';

const PharmacyRegistrationPending = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4 pb-24">
      <div className="w-full max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="border-2 shadow-lg text-center">
          <CardHeader className="space-y-4 pb-4">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary mx-auto">
              <Clock className="h-10 w-10 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Demande en cours de traitement</CardTitle>
            <CardDescription className="text-base">
              Votre inscription a été envoyée avec succès
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Vérifiez votre email</p>
                  <p className="text-sm text-muted-foreground">
                    Un email de confirmation a été envoyé à votre adresse. Pensez à vérifier vos spams.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Validation de votre compte</p>
                  <p className="text-sm text-muted-foreground">
                    Notre équipe va vérifier votre demande. Vous recevrez un email dès que votre compte sera validé.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Button
                onClick={() => navigate('/')}
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
              >
                Retour à l'accueil
              </Button>
              
              <Button
                variant="outline"
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Se connecter
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              En cas de questions, contactez-nous à support@arthur.fr
            </p>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default PharmacyRegistrationPending;
