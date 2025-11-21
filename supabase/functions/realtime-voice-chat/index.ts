import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";

serve(async (req) => {
  try {
    console.log('Received WebSocket upgrade request');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade request", { status: 426 });
    }

    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    let openaiSocket: WebSocket | null = null;
    let sessionConfigured = false;

    // Get user context from query params
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const selectedPharmacyId = url.searchParams.get('selectedPharmacyId');

    console.log('User context:', { userId, selectedPharmacyId });

    // Fetch user profile and pharmacy products
    let systemInstructions = '';
    
    if (userId || selectedPharmacyId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch user profile
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender, age, is_pregnant, allergies, medical_history')
          .eq('id', userId)
          .single();

        if (profile) {
          systemInstructions += `\n\nInformations du patient :
- Sexe : ${profile.gender || 'non renseigné'}
- Âge : ${profile.age ? `${profile.age} ans` : 'non renseigné'}
${profile.gender === 'femme' && profile.is_pregnant ? '- Enceinte : Oui\n' : ''}${profile.allergies ? `- Allergies : ${profile.allergies}\n` : ''}${profile.medical_history ? `- Antécédents médicaux : ${profile.medical_history}\n` : ''}`;
        }
      }

      // Fetch pharmacy products
      if (selectedPharmacyId) {
        const { data: pharmacy } = await supabase
          .from('pharmacies')
          .select('name, address, city')
          .eq('id', selectedPharmacyId)
          .single();

        if (pharmacy) {
          systemInstructions += `\n\nPharmacie sélectionnée : ${pharmacy.name} - ${pharmacy.address}, ${pharmacy.city}`;
        }

        const { data: products } = await supabase
          .from('products')
          .select(`
            id,
            name,
            brand,
            category,
            description,
            price,
            pharmacy_products!inner(
              pharmacy_id,
              stock_quantity,
              is_available
            )
          `)
          .eq('pharmacy_products.pharmacy_id', selectedPharmacyId)
          .eq('pharmacy_products.is_available', true)
          .gt('pharmacy_products.stock_quantity', 0)
          .limit(100);

        if (products && products.length > 0) {
          systemInstructions += `\n\nProduits disponibles :\n${products.map(p => 
            `- ${p.name} (${p.brand}) - ${p.category} - ${p.price}€`
          ).join('\n')}`;
        }
      }
    }

    const baseInstructions = `Tu es Arthur, assistant vocal avenant, gentil et compatissant, spécialisé en produits parapharmaceutiques.

Tu communiques de vive voix avec les clients dans leur langue (français, anglais, etc.). Adapte automatiquement ta langue à celle du client.

TON CARACTÈRE :
- AVENANT et accueillant
- GENTIL et bienveillant
- COMPATISSANT et à l'écoute
- Ton CHALEUREUX et RASSURANT

TU ES SPÉCIALISTE EN PARAPHARMACIE UNIQUEMENT :
- Produits de soins et d'hygiène
- Compléments alimentaires
- Cosmétiques
- Aromathérapie

LIMITES STRICTES :
- Tu NE prescris JAMAIS de médicaments
- Tu NE fais JAMAIS de diagnostic médical
- Tu NE remplaces JAMAIS le pharmacien ou médecin
- Tu recommandes UNIQUEMENT les produits parapharmaceutiques disponibles dans la pharmacie sélectionnée

VENTE SUGGESTIVE :
- Suggère des produits complémentaires pertinents
- Propose des routines complètes
- Reste naturel - ne force jamais la vente

En cas de doute médical, oriente vers le pharmacien ou médecin.${systemInstructions}`;

    clientSocket.onopen = () => {
      console.log('Client WebSocket connected');
      
      // Connect to OpenAI
      console.log('Connecting to OpenAI Realtime API...');
      openaiSocket = new WebSocket(OPENAI_WS_URL, {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1"
        }
      });

      openaiSocket.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
      };

      openaiSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('OpenAI message type:', data.type);

        // Configure session after receiving session.created
        if (data.type === 'session.created' && !sessionConfigured) {
          console.log('Configuring session...');
          sessionConfigured = true;
          
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: baseInstructions,
              voice: 'shimmer',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000
              },
              temperature: 0.8,
              max_response_output_tokens: 4096
            }
          };
          
          openaiSocket!.send(JSON.stringify(sessionConfig));
          console.log('Session configuration sent');
        }

        // Forward all OpenAI messages to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }
      };

      openaiSocket.onerror = (error) => {
        console.error('OpenAI WebSocket error:', error);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ 
            type: 'error', 
            error: 'OpenAI connection error' 
          }));
        }
      };

      openaiSocket.onclose = () => {
        console.log('OpenAI WebSocket closed');
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.close();
        }
      };
    };

    clientSocket.onmessage = (event) => {
      console.log('Client message received');
      if (openaiSocket && openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.send(event.data);
      }
    };

    clientSocket.onerror = (error) => {
      console.error('Client WebSocket error:', error);
    };

    clientSocket.onclose = () => {
      console.log('Client WebSocket closed');
      if (openaiSocket && openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.close();
      }
    };

    return response;
  } catch (error) {
    console.error('Error in realtime-voice-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
