import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceInterfaceProps {
  userId: string | null;
  selectedPharmacyId: string | null;
  onDisplayProducts?: (products: any[]) => void;
  onAddToCart?: (product: any) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onNavigate?: (page: string, message?: string, guidance?: string) => void;
}

const VoiceInterface = ({ userId, selectedPharmacyId, onDisplayProducts, onAddToCart, onTranscript, onSpeakingChange, onNavigate }: VoiceInterfaceProps) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = async () => {
    try {
      // Check Web Speech API support
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error('Votre navigateur ne supporte pas la reconnaissance vocale');
      }

      // Initialize speech recognition
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'fr-FR';
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        setIsConnected(true);
        setIsListening(true);
        toast({
          title: "🎙️ Connexion établie",
          description: "Arthur vous écoute, parlez naturellement",
        });
      };

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        console.log('User said:', transcript);
        
        // Display user's transcript
        onTranscript?.(transcript, true);
        
        // Stop listening while processing
        setIsListening(false);
        
        // Process the message
        await processMessage(transcript);
        
        // Resume listening
        if (recognitionRef.current && isConnected) {
          setIsListening(true);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          toast({
            title: "Erreur",
            description: "Erreur de reconnaissance vocale",
            variant: "destructive",
          });
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        if (isConnected) {
          // Restart if still connected
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.log('Recognition restart prevented:', e);
          }
        }
      };

      // Start recognition
      recognitionRef.current.start();

    } catch (error) {
      console.error('Error connecting:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'accéder au microphone",
        variant: "destructive",
      });
    }
  };

  const processMessage = async (message: string) => {
    try {
      // Call voice-chat function
      const { data, error } = await supabase.functions.invoke('voice-chat', {
        body: {
          message,
          userId,
          selectedPharmacyId,
          conversationId: conversationIdRef.current
        }
      });

      if (error) throw error;

      const { text, toolCalls } = data;

      // Handle tool calls
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          if (toolCall.type === 'display_products') {
            onDisplayProducts?.(toolCall.data.products);
          } else if (toolCall.type === 'add_to_cart') {
            onAddToCart?.(toolCall.data);
          } else if (toolCall.type === 'navigate') {
            onNavigate?.(toolCall.data.page, toolCall.data.message, toolCall.data.guidance);
          } else if (toolCall.type === 'search_results') {
            // Results are included in the text response
            console.log('Search results:', toolCall.results);
          }
        }
      }

      if (text) {
        // Display Arthur's text response
        onTranscript?.(text, true);
        
        // Convert to speech
        speakText(text);
      }

    } catch (error) {
      console.error('Error processing message:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du traitement du message",
        variant: "destructive",
      });
    }
  };

  const speakText = (text: string) => {
    if (!text || !('speechSynthesis' in window)) {
      console.log('Speech synthesis not available');
      return;
    }
    
    setIsSpeaking(true);
    onSpeakingChange?.(true);
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.3; // Faster speech for more dynamism
    utterance.pitch = 0.85; // Lower pitch for male voice
    utterance.volume = 1.0;
    
    // Load voices and try to select a male French voice
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Try to find a male French voice
      const maleVoice = voices.find(voice => 
        voice.lang.startsWith('fr') && 
        (voice.name.toLowerCase().includes('male') || 
         voice.name.toLowerCase().includes('homme') ||
         voice.name.toLowerCase().includes('thomas') ||
         voice.name.toLowerCase().includes('daniel') ||
         voice.name.toLowerCase().includes('henri'))
      );
      
      if (maleVoice) {
        utterance.voice = maleVoice;
        console.log('Using male voice:', maleVoice.name);
      } else {
        // Fallback: use first available French voice
        const frenchVoice = voices.find(voice => voice.lang.startsWith('fr'));
        if (frenchVoice) {
          utterance.voice = frenchVoice;
          console.log('Using French voice:', frenchVoice.name);
        }
      }
    };
    
    // Voices may not be loaded yet
    if (window.speechSynthesis.getVoices().length > 0) {
      setVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoice();
      };
    }
    
    utterance.onend = () => {
      setIsSpeaking(false);
      onSpeakingChange?.(false);
    };
    
    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
      setIsSpeaking(false);
      onSpeakingChange?.(false);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const disconnect = () => {
    console.log('Disconnecting...');
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    // Cancel any ongoing speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  };

  return (
    <div className="flex items-center justify-between w-full gap-2 px-2 py-2 bg-muted/50 rounded-lg">
      {/* Voice Visualizer - inline next to mic */}
      {isConnected && isSpeaking && (
        <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-left-2 duration-300">
          <div className="flex items-center gap-1 h-8">
            {[40, 60, 80, 60, 40].map((_, index) => (
              <div
                key={index}
                className="w-1 bg-primary rounded-full transition-all duration-150 ease-in-out animate-pulse"
                style={{
                  height: `${Math.random() * 60 + 20}%`,
                  opacity: 0.6 + (Math.random() * 0.4),
                  animationDelay: `${index * 0.1}s`
                }}
              />
            ))}
          </div>
          <span className="text-xs text-primary font-medium">Arthur parle...</span>
        </div>
      )}
      
      {/* Status indicator */}
      {isConnected && !isSpeaking && (
        <div className="flex items-center gap-2 text-xs flex-shrink-0">
          {isListening && (
            <div className="flex items-center gap-1 text-green-600 animate-pulse">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Vous parlez</span>
            </div>
          )}
          
          {!isListening && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">En écoute</span>
            </div>
          )}
        </div>
      )}

      {/* Control button */}
      {!isConnected ? (
        <Button 
          onClick={connect}
          size="sm"
          className="bg-primary hover:bg-primary/90 flex-shrink-0"
        >
          <Mic className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Parler</span>
        </Button>
      ) : (
        <Button 
          onClick={disconnect}
          size="sm"
          variant="secondary"
          className="flex-shrink-0"
        >
          <MicOff className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Arrêter</span>
        </Button>
      )}
    </div>
  );
};

export default VoiceInterface;
