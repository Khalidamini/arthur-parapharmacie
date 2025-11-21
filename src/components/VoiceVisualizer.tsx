import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

interface VoiceVisualizerProps {
  isSpeaking: boolean;
}

const VoiceVisualizer = ({ isSpeaking }: VoiceVisualizerProps) => {
  const [bars, setBars] = useState<number[]>([40, 60, 80, 60, 40]);

  useEffect(() => {
    if (!isSpeaking) {
      setBars([40, 60, 80, 60, 40]);
      return;
    }

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random() * 60 + 20));
    }, 150);

    return () => clearInterval(interval);
  }, [isSpeaking]);

  if (!isSpeaking) return null;

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-gradient-primary/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg border border-primary/20">
        <div className="flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-primary-foreground animate-pulse" />
          
          <div className="flex items-center gap-1 h-12">
            {bars.map((height, index) => (
              <div
                key={index}
                className="w-1 bg-primary-foreground rounded-full transition-all duration-150 ease-in-out"
                style={{
                  height: `${height}%`,
                  opacity: 0.6 + (height / 100) * 0.4,
                }}
              />
            ))}
          </div>
          
          <span className="text-sm font-medium text-primary-foreground">
            Arthur parle...
          </span>
        </div>
      </div>
    </div>
  );
};

export default VoiceVisualizer;
