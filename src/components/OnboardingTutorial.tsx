import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Volume2, VolumeX, X, ArrowRight, SkipForward } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TutorialStep {
  title: string;
  description: string;
  audioText: string;
  page?: string;
  highlight?: string;
  action?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Bienvenue sur votre application de parapharmacie !",
    description: "Je suis Arthur, votre assistant personnel. Je vais vous guider à travers les fonctionnalités principales.",
    audioText: "Bonjour et bienvenue ! Je suis Arthur, votre assistant virtuel en parapharmacie. Je vais vous faire découvrir toutes les fonctionnalités de l'application pour que vous puissiez en profiter pleinement. Vous pouvez me parler à tout moment pour obtenir de l'aide.",
    page: "/",
  },
  {
    title: "Scanner votre pharmacie",
    description: "Commencez par scanner le QR code de votre pharmacie pour accéder à ses produits et promotions.",
    audioText: "La première étape est de scanner le QR code de votre pharmacie préférée. Vous le trouverez à l'entrée de la pharmacie ou sur leurs supports de communication. Cela vous permettra d'accéder à tous leurs produits et promotions en exclusivité.",
    page: "/scan-qr",
    action: "scan",
  },
  {
    title: "Découvrir la boutique",
    description: "Parcourez le catalogue de produits disponibles dans votre pharmacie.",
    audioText: "Une fois votre pharmacie scannée, vous pouvez explorer leur boutique complète. Vous y trouverez tous les produits de parapharmacie disponibles : cosmétiques, compléments alimentaires, soins du corps, et bien plus encore. Vous pouvez rechercher et filtrer par catégorie.",
    page: "/shop",
    action: "browse",
  },
  {
    title: "Ne ratez aucune promotion",
    description: "Consultez les promotions en cours dans votre pharmacie.",
    audioText: "Votre pharmacie propose régulièrement des promotions attractives. Dans la section Promotions, vous découvrirez toutes les offres du moment avec les réductions en cours. C'est le meilleur endroit pour faire de bonnes affaires !",
    page: "/promotions",
    action: "view_promos",
  },
  {
    title: "Parlez-moi à tout moment",
    description: "Utilisez le chat vocal ou textuel pour obtenir des conseils personnalisés.",
    audioText: "Vous pouvez me parler à tout moment, soit par écrit, soit avec votre voix. Posez-moi des questions sur les produits, demandez-moi des recommandations, ou demandez-moi de vous guider dans l'application. Je suis là pour vous aider ! Par exemple, vous pouvez dire 'Montre-moi les promotions' ou 'Ajoute ce produit au panier'.",
    page: "/chat",
    action: "chat",
  },
  {
    title: "Votre panier et vos commandes",
    description: "Gérez facilement vos achats et suivez vos commandes.",
    audioText: "Quand vous trouvez un produit qui vous intéresse, ajoutez-le simplement au panier. Vous pourrez ensuite passer commande pour un retrait en pharmacie ou une livraison à domicile. Toutes vos commandes sont accessibles dans la section Mes Commandes.",
    page: "/cart",
    action: "cart",
  },
  {
    title: "Vous êtes prêt !",
    description: "Profitez de votre application et n'hésitez pas à me solliciter.",
    audioText: "Voilà, vous connaissez maintenant les fonctionnalités principales ! N'oubliez pas que je suis toujours disponible pour vous aider. Vous pouvez me parler à n'importe quel moment pour obtenir des conseils, des recommandations, ou simplement pour naviguer dans l'application. Bonne découverte !",
    page: "/",
    action: "complete",
  },
];

interface OnboardingTutorialProps {
  userId: string;
  onComplete?: () => void;
}

const OnboardingTutorial = ({ userId, onComplete }: OnboardingTutorialProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkOnboardingStatus();
  }, [userId]);

  const checkOnboardingStatus = async () => {
    if (!userId) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error checking onboarding status:', error);
      return;
    }

    // Show tutorial if not completed
    if (!profile?.onboarding_completed) {
      setIsOpen(true);
    }
  };

  const playStepAudio = async (text: string) => {
    if (!audioEnabled) return;

    try {
      setIsPlayingAudio(true);

      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice: 'alloy' }
      });

      if (error) throw error;

      if (data?.audioContent) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
          { type: 'audio/mp3' }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlayingAudio(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentStep < TUTORIAL_STEPS.length) {
      const step = TUTORIAL_STEPS[currentStep];
      if (audioEnabled) {
        playStepAudio(step.audioText);
      }
    }
  }, [currentStep, isOpen, audioEnabled]);

  const handleNext = () => {
    const step = TUTORIAL_STEPS[currentStep];
    
    // Navigate to the step's page if specified
    if (step.page && step.page !== window.location.pathname) {
      navigate(step.page);
    }

    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const handleSkip = () => {
    completeTutorial();
  };

  const completeTutorial = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      setIsOpen(false);
      toast({
        title: "✅ Tutoriel terminé",
        description: "Vous pouvez le relancer à tout moment depuis votre profil.",
      });

      onComplete?.();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la progression",
        variant: "destructive",
      });
    }
  };

  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;
  const step = TUTORIAL_STEPS[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl flex items-center gap-2">
              <img src="/icon-192.png" alt="Arthur" className="h-8 w-8 rounded-full" />
              Tutoriel avec Arthur
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="h-8 w-8"
              >
                {audioEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSkip}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogDescription className="text-base mt-2">
            Étape {currentStep + 1} sur {TUTORIAL_STEPS.length}
          </DialogDescription>
          <Progress value={progress} className="h-2 mt-2" />
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {isPlayingAudio && (
            <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-1">
                {[40, 60, 80, 60, 40].map((_, index) => (
                  <div
                    key={index}
                    className="w-1 bg-primary rounded-full transition-all duration-150 ease-in-out animate-pulse"
                    style={{
                      height: `${Math.random() * 60 + 20}%`,
                      opacity: 0.6 + Math.random() * 0.4,
                      animationDelay: `${index * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              <span className="text-sm text-primary font-medium">
                Arthur vous parle...
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="flex-1"
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Passer le tutoriel
            </Button>
            <Button
              onClick={handleNext}
              className="flex-1 bg-gradient-primary hover:opacity-90"
              disabled={isPlayingAudio}
            >
              {currentStep === TUTORIAL_STEPS.length - 1 ? (
                <>Terminer</>
              ) : (
                <>
                  Continuer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingTutorial;
