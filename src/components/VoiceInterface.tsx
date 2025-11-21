import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { AudioRecorder, encodeAudioForAPI, playAudioData, clearAudioQueue } from '@/utils/RealtimeAudio';

interface VoiceInterfaceProps {
  userId: string | null;
  selectedPharmacyId: string | null;
}

const VoiceInterface = ({ userId, selectedPharmacyId }: VoiceInterfaceProps) => {
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
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log('Initializing audio context...');
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      console.log('Connecting to voice chat...');
      const wsUrl = `wss://gtjmebionytcomoldgjl.supabase.co/functions/v1/realtime-voice-chat?userId=${userId || ''}&selectedPharmacyId=${selectedPharmacyId || ''}`;
      console.log('WebSocket URL:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        startRecording();
        
        toast({
          title: "Connexion établie",
          description: "Arthur vous écoute",
        });
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Received message type:', data.type);

        if (data.type === 'response.audio.delta') {
          setIsSpeaking(true);
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
            description: data.error,
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
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket closed');
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
    <div className="flex flex-col items-center gap-4 p-6 bg-card rounded-lg border shadow-sm">
      <div className="flex items-center gap-3">
        {isSpeaking && (
          <div className="flex items-center gap-2 text-primary animate-pulse">
            <Volume2 className="h-5 w-5" />
            <span className="text-sm font-medium">Arthur parle...</span>
          </div>
        )}
        
        {isListening && !isSpeaking && (
          <div className="flex items-center gap-2 text-green-600 animate-pulse">
            <Mic className="h-5 w-5" />
            <span className="text-sm font-medium">Vous parlez...</span>
          </div>
        )}
        
        {isConnected && !isListening && !isSpeaking && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mic className="h-5 w-5" />
            <span className="text-sm font-medium">En écoute...</span>
          </div>
        )}
      </div>

      {!isConnected ? (
        <Button 
          onClick={connect}
          size="lg"
          className="bg-primary hover:bg-primary/90"
        >
          <Mic className="h-5 w-5 mr-2" />
          Parler avec Arthur
        </Button>
      ) : (
        <Button 
          onClick={disconnect}
          size="lg"
          variant="secondary"
        >
          <MicOff className="h-5 w-5 mr-2" />
          Terminer la conversation
        </Button>
      )}
      
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Parlez naturellement dans la langue de votre choix. Arthur vous répondra vocalement.
      </p>
    </div>
  );
};

export default VoiceInterface;
