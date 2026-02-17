export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      console.log('Starting audio recorder...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Use the stream's actual sample rate to avoid mismatch errors
      const trackSettings = this.stream.getAudioTracks()[0]?.getSettings();
      const nativeSampleRate = trackSettings?.sampleRate || 48000;
      console.log('Microphone native sample rate:', nativeSampleRate);

      this.audioContext = new AudioContext({ sampleRate: nativeSampleRate });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      const targetSampleRate = 24000;

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Resample from native rate to 24000Hz for the OpenAI Realtime API
        if (nativeSampleRate === targetSampleRate) {
          this.onAudioData(new Float32Array(inputData));
        } else {
          const ratio = nativeSampleRate / targetSampleRate;
          const outputLength = Math.floor(inputData.length / ratio);
          const output = new Float32Array(outputLength);
          for (let i = 0; i < outputLength; i++) {
            const srcIndex = Math.floor(i * ratio);
            output[i] = inputData[srcIndex];
          }
          this.onAudioData(output);
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('Audio recorder started successfully');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    console.log('Stopping audio recorder...');
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('Audio recorder stopped');
  }
}

export const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
};

export const createWavFromPCM = (pcmData: Uint8Array): Uint8Array => {
  const int16Data = new Int16Array(pcmData.length / 2);
  for (let i = 0; i < pcmData.length; i += 2) {
    int16Data[i / 2] = (pcmData[i + 1] << 8) | pcmData[i];
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + int16Data.byteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, int16Data.byteLength, true);

  const wavArray = new Uint8Array(wavHeader.byteLength + int16Data.byteLength);
  wavArray.set(new Uint8Array(wavHeader), 0);
  wavArray.set(new Uint8Array(int16Data.buffer), wavHeader.byteLength);

  return wavArray;
};

class AudioQueue {
  private queue: Uint8Array[] = [];
  private audioContext: AudioContext;
  private nextStartTime: number = 0;
  private isPlaying = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async addToQueue(audioData: Uint8Array) {
    console.log('Adding audio chunk to queue, size:', audioData.length);
    this.queue.push(audioData);

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.nextStartTime = this.audioContext.currentTime;
      this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      console.log('Audio queue empty');
      return;
    }

    const audioData = this.queue.shift()!;

    try {
      // Convert PCM16 to Float32 for Web Audio API
      const int16Data = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 2);
      const float32Data = new Float32Array(int16Data.length);

      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      // Create audio buffer at 24000Hz (OpenAI output rate)
      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.copyToChannel(float32Data, 0);

      // Create source and schedule playback
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // Calculate when this chunk should start
      const now = this.audioContext.currentTime;
      const startTime = Math.max(now, this.nextStartTime);

      // Update next start time for seamless playback
      this.nextStartTime = startTime + audioBuffer.duration;

      source.onended = () => {
        this.playNext();
      };

      source.start(startTime);
    } catch (error) {
      console.error('Error playing audio:', error);
      this.playNext();
    }
  }

  clear() {
    this.queue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
  }
}

let audioQueueInstance: AudioQueue | null = null;

export const playAudioData = async (audioContext: AudioContext, audioData: Uint8Array) => {
  if (!audioQueueInstance) {
    audioQueueInstance = new AudioQueue(audioContext);
  }
  await audioQueueInstance.addToQueue(audioData);
};

export const clearAudioQueue = () => {
  if (audioQueueInstance) {
    audioQueueInstance.clear();
  }
};
