import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Settings, Loader2 } from 'lucide-react';
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

const VoiceInterface = ({ 
  userId, 
  selectedPharmacyId, 
  onDisplayProducts, 
  onAddToCart, 
  onTranscript, 
  onSpeakingChange, 
  onNavigate 
}: VoiceInterfaceProps) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('onyx');
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Available OpenAI voices
  const availableVoices = [
    { value: 'onyx', label: 'Onyx (Voix grave masculine)' },
    { value: 'echo', label: 'Echo (Voix masculine)' },
    { value: 'fable', label: 'Fable (Voix neutre)' },
  ];

  // Load saved preferences
  useEffect(() => {
    const savedVoice = localStorage.getItem('arthur-voice-preference');
    const savedSpeed = localStorage.getItem('arthur-speech-speed');
    
    if (savedVoice) setSelectedVoice(savedVoice);
    if (savedSpeed) setSpeechSpeed(parseFloat(savedSpeed));
  }, []);

  // Save preferences when changed
  useEffect(() => {
    localStorage.setItem('arthur-voice-preference', selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    localStorage.setItem('arthur-speech-speed', speechSpeed.toString());
  }, [speechSpeed]);

  const connect = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        
        // Process the recorded audio
        await processAudioBlob(audioBlob);
      };

      // Start recording
      mediaRecorder.start();
      setIsConnected(true);
      setIsListening(true);
      
      toast({
        title: "🎙️ Connexion établie",
        description: "Arthur vous écoute via OpenAI",
      });

    } catch (error) {
      console.error('Error connecting:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'accéder au microphone",
        variant: "destructive",
      });
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const processAudioBlob = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      await new Promise((resolve) => {
        reader.onloadend = resolve;
      });
      
      const base64Audio = (reader.result as string).split(',')[1];

      // Send to speech-to-text
      console.log('Sending audio to Whisper...');
      const { data: sttData, error: sttError } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (sttError) throw sttError;

      const transcript = sttData.text;
      console.log('Transcribed:', transcript);
      
      if (!transcript || transcript.trim().length === 0) {
        console.log('Empty transcript, skipping');
        setIsProcessing(false);
        // Restart listening
        if (isConnected) {
          audioChunksRef.current = [];
          mediaRecorderRef.current?.start();
          setIsListening(true);
        }
        return;
      }

      // Stop Arthur if speaking (interruption)
      if (isSpeaking && currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
        setIsSpeaking(false);
        onSpeakingChange?.(false);
      }

      // Display user's transcript
      onTranscript?.(transcript, true);

      // Process the message with voice-chat
      await processMessage(transcript);

    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Erreur",
        description: "Impossible de traiter l'audio",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      // Restart listening
      if (isConnected && mediaRecorderRef.current) {
        audioChunksRef.current = [];
        mediaRecorderRef.current.start();
        setIsListening(true);
      }
    }
  };

  const processMessage = async (message: string) => {
    try {
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
          }
        }
      }

      if (text) {
        // Display Arthur's text response
        onTranscript?.(text, true);
        
        // Convert to speech
        await speakText(text);
      }

    } catch (error) {
      console.error('Error processing message:', error);
      toast({
        title: "Erreur",
        description: "Impossible de traiter votre message",
        variant: "destructive",
      });
    }
  };

  const speakText = async (text: string) => {
    if (!text) return;
    
    setIsSpeaking(true);
    onSpeakingChange?.(true);
    
    try {
      console.log('Converting text to speech with OpenAI...');
      
      // Call text-to-speech
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text, 
          voice: selectedVoice,
          speed: speechSpeed
        }
      });

      if (ttsError) throw ttsError;

      // Decode base64 audio and play
      const audioData = atob(ttsData.audioContent);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        console.log('Speech ended');
        setIsSpeaking(false);
        onSpeakingChange?.(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setIsSpeaking(false);
        onSpeakingChange?.(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();

    } catch (error) {
      console.error('Error speaking text:', error);
      setIsSpeaking(false);
      onSpeakingChange?.(false);
      toast({
        title: "Erreur vocale",
        description: "Impossible de générer la voix",
        variant: "destructive",
      });
    }
  };

  const disconnect = () => {
    console.log('Disconnecting...');
    
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
  };

  return (
    <div className="flex items-center justify-between w-full gap-2 px-2 py-2 bg-muted/50 rounded-lg">
      {/* Voice Visualizer */}
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
      
      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">Traitement...</span>
        </div>
      )}
      
      {/* Status indicator */}
      {isConnected && !isSpeaking && !isProcessing && (
        <div className="flex items-center gap-2 text-xs flex-shrink-0">
          {isListening && (
            <div className="flex items-center gap-1 text-green-600 animate-pulse">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">En écoute OpenAI</span>
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
              <Label htmlFor="voice-select">Voix OpenAI</Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger id="voice-select">
                  <SelectValue placeholder="Sélectionnez une voix" />
                </SelectTrigger>
                <SelectContent>
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="speed-slider">Vitesse</Label>
                <span className="text-sm text-muted-foreground">{speechSpeed.toFixed(1)}x</span>
              </div>
              <Slider
                id="speed-slider"
                min={0.5}
                max={2}
                step={0.1}
                value={[speechSpeed]}
                onValueChange={(value) => setSpeechSpeed(value[0])}
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

      {/* Control buttons */}
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
        <>
          {isListening && (
            <Button 
              onClick={stopListening}
              size="sm"
              variant="outline"
              className="flex-shrink-0"
            >
              <MicOff className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Pause</span>
            </Button>
          )}
          <Button 
            onClick={disconnect}
            size="sm"
            variant="secondary"
            className="flex-shrink-0"
          >
            <MicOff className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Arrêter</span>
          </Button>
        </>
      )}
    </div>
  );
};

export default VoiceInterface;
