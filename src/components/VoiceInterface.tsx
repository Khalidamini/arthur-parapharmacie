import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { AudioRecorder, encodeAudioForAPI, playAudioData, clearAudioQueue } from '@/utils/RealtimeAudio';

interface VoiceInterfaceProps {
  userId: string | null;
  selectedPharmacyId: string | null;
  onDisplayProducts?: (products: any[]) => void;
  onAddToCart?: (product: any) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

const VoiceInterface = ({ userId, selectedPharmacyId, onDisplayProducts, onAddToCart, onTranscript, onSpeakingChange }: VoiceInterfaceProps) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = async () => {
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately, just checking permission
      
      console.log('Initializing audio context...');
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      console.log('Connecting to voice chat...');
      const wsUrl = `wss://gtjmebionytcomoldgjl.supabase.co/functions/v1/realtime-voice-chat?userId=${userId || ''}&selectedPharmacyId=${selectedPharmacyId || ''}`;
      console.log('WebSocket URL:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        startRecording();
        
        toast({
          title: "🎙️ Connexion établie",
          description: "Arthur vous écoute, parlez naturellement",
        });
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Received message type:', data.type);

        // Handle product display request from Arthur
        if (data.type === 'display_products' && data.products) {
          console.log('Displaying products:', data.products);
          onDisplayProducts?.(data.products);
        }

        // Handle add to cart request from Arthur
        if (data.type === 'add_to_cart' && data.product) {
          console.log('Adding product to cart:', data.product);
          onAddToCart?.(data.product);
        }

        // Handle transcript deltas for text display
        if (data.type === 'response.audio_transcript.delta') {
          console.log('Transcript delta:', data.delta);
          onTranscript?.(data.delta, false);
        }

        // Handle transcript done for final text
        if (data.type === 'response.audio_transcript.done') {
          console.log('Transcript done:', data.transcript);
          onTranscript?.(data.transcript, true);
        }

        if (data.type === 'response.audio.delta') {
          setIsSpeaking(true);
          onSpeakingChange?.(true);
          
          // Resume audio context if suspended
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
          
          const binaryString = atob(data.delta);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          if (audioContextRef.current) {
            await playAudioData(audioContextRef.current, bytes);
          }
        } else if (data.type === 'response.audio.done') {
          console.log('Audio response complete');
          setIsSpeaking(false);
          onSpeakingChange?.(false);
        } else if (data.type === 'input_audio_buffer.speech_started') {
          console.log('User started speaking');
          setIsListening(true);
        } else if (data.type === 'input_audio_buffer.speech_stopped') {
          console.log('User stopped speaking');
          setIsListening(false);
        } else if (data.type === 'error') {
          console.error('Server error:', data.error);
          toast({
            title: "Erreur",
            description: data.error?.message || "Une erreur est survenue",
            variant: "destructive",
          });
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Erreur de connexion",
          description: "Impossible de se connecter au service vocal",
          variant: "destructive",
        });
        disconnect();
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (event.code !== 1000) {
          toast({
            title: "Connexion perdue",
            description: "La connexion vocale a été interrompue",
            variant: "destructive",
          });
        }
        setIsConnected(false);
        setIsListening(false);
        setIsSpeaking(false);
        stopRecording();
      };

    } catch (error) {
      console.error('Error connecting:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'accéder au microphone",
        variant: "destructive",
      });
    }
  };

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      recorderRef.current = new AudioRecorder((audioData) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const encoded = encodeAudioForAPI(audioData);
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encoded
          }));
        }
      });
      await recorderRef.current.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'accéder au microphone",
        variant: "destructive",
      });
      disconnect();
    }
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      console.log('Stopping recording...');
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  };

  const disconnect = () => {
    console.log('Disconnecting...');
    stopRecording();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    clearAudioQueue();
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
