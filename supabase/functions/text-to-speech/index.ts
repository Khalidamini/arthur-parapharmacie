import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, lang = 'fr' } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    console.log('Generating speech for text:', text.substring(0, 50), 'Language:', lang);

    // Split text into chunks if too long (Google TTS has ~200 char limit)
    const maxLength = 200;
    const chunks = [];
    
    if (text.length > maxLength) {
      // Split by sentences
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxLength) {
          currentChunk += sentence;
        } else {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = sentence;
        }
      }
      if (currentChunk) chunks.push(currentChunk);
    } else {
      chunks.push(text);
    }

    console.log(`Text split into ${chunks.length} chunks`);

    // Generate audio for each chunk
    const audioBuffers = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim();
      if (!chunk) continue;
      
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);
      
      const encodedText = encodeURIComponent(chunk);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=gtx&q=${encodedText}`;

      const response = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/',
        },
      });

      if (!response.ok) {
        console.error('Google TTS error for chunk:', response.status, response.statusText);
        throw new Error(`Failed to generate speech: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      audioBuffers.push(new Uint8Array(arrayBuffer));
      
      // Small delay between requests to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Combine all audio buffers
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buffer of audioBuffers) {
      combinedBuffer.set(buffer, offset);
      offset += buffer.length;
    }

    // Convert to base64
    const base64Audio = btoa(String.fromCharCode(...combinedBuffer));

    console.log('Successfully generated audio, size:', combinedBuffer.length, 'bytes');

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
