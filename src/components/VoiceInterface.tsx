import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

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
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.3);
  const recognitionRef = useRef<any>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedVoice = localStorage.getItem('arthur-voice-preference');
    const savedRate = localStorage.getItem('arthur-speech-rate');
    
    if (savedRate) {
      setSpeechRate(parseFloat(savedRate));
    }
    
    // Load available voices
    const loadVoices = () => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        // Filter for French male voices
        const frenchVoices = voices.filter(voice => 
          voice.lang.startsWith('fr')
        );
        setAvailableVoices(frenchVoices);
        
        // Use saved voice if available, otherwise auto-select
        if (frenchVoices.length > 0) {
          if (savedVoice && frenchVoices.some(v => v.name === savedVoice)) {
            setSelectedVoice(savedVoice);
          } else if (!selectedVoice) {
            const maleVoice = frenchVoices.find(voice => 
              voice.name.toLowerCase().includes('male') || 
              voice.name.toLowerCase().includes('homme') ||
              voice.name.toLowerCase().includes('thomas') ||
              voice.name.toLowerCase().includes('daniel') ||
              voice.name.toLowerCase().includes('henri')
            );
            const defaultVoice = (maleVoice || frenchVoices[0]).name;
            setSelectedVoice(defaultVoice);
            localStorage.setItem('arthur-voice-preference', defaultVoice);
          }
        }
      }
    };

    loadVoices();
    
    // Voices might load asynchronously
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      disconnect();
    };
  }, []);

  // Save voice preference when changed
  useEffect(() => {
    if (selectedVoice) {
      localStorage.setItem('arthur-voice-preference', selectedVoice);
    }
  }, [selectedVoice]);

  // Save speech rate when changed
  useEffect(() => {
    localStorage.setItem('arthur-speech-rate', speechRate.toString());
  }, [speechRate]);

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
        
        // Skip empty or whitespace-only transcripts
        if (!transcript || transcript.trim().length === 0) {
          console.log('Skipping empty transcript');
          return;
        }
        
        // Display user's transcript
        onTranscript?.(transcript, true);
        
        // Process the message (keep listening in background)
        await processMessage(transcript);
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
        console.log('Speech recognition ended, restarting...');
        // Always restart if still connected and recognition exists
        if (isConnected && recognitionRef.current) {
          setTimeout(() => {
            try {
              if (recognitionRef.current && isConnected) {
                recognitionRef.current.start();
                console.log('Recognition restarted successfully');
              }
            } catch (e) {
              console.log('Recognition restart prevented:', e);
              // Retry after a short delay
              setTimeout(() => {
                if (recognitionRef.current && isConnected) {
                  try {
                    recognitionRef.current.start();
                  } catch (err) {
                    console.error('Failed to restart recognition:', err);
                  }
                }
              }, 200);
            }
          }, 100);
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
      // Additional client-side validation
      if (!message || message.trim().length === 0) {
        console.log('Skipping empty message');
        return;
      }

      // Call voice-chat function
      const { data, error } = await supabase.functions.invoke('voice-chat', {
        body: {
          message: message.trim(),
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
        description: "Désolé, je n'ai pas pu traiter votre message. Veuillez réessayer.",
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
    utterance.rate = speechRate; // Use user-selected rate
    utterance.pitch = 0.85; // Lower pitch for male voice
    utterance.volume = 1.0;
    
    // Use selected voice
    if (selectedVoice) {
      const voice = availableVoices.find(v => v.name === selectedVoice);
      if (voice) {
        utterance.voice = voice;
        console.log('Using voice:', voice.name, 'at rate:', speechRate);
      }
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

      {/* Voice settings */}
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            size="sm" 
            variant="ghost" 
            className="flex-shrink-0 h-8 w-8 p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice-select">Voix masculine</Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger id="voice-select">
                  <SelectValue placeholder="Sélectionnez une voix" />
                </SelectTrigger>
                <SelectContent>
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.name} value={voice.name}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="speed-slider">Vitesse</Label>
                <span className="text-sm text-muted-foreground">{speechRate.toFixed(1)}x</span>
              </div>
              <Slider
                id="speed-slider"
                min={0.5}
                max={2}
                step={0.1}
                value={[speechRate]}
                onValueChange={(value) => setSpeechRate(value[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Lent (0.5x)</span>
                <span>Normal (1.0x)</span>
                <span>Rapide (2.0x)</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

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
