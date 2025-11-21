import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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
    let openaiSocket: WebSocket;
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
            image_url,
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

TU ES SPÉCIALISTE EN PARAPHARMACIE UNIQUEMENT. Tu NE prescris JAMAIS de médicaments, tu NE fais JAMAIS de diagnostic médical, tu NE remplaces JAMAIS le pharmacien ou médecin. 

AFFICHAGE DES PRODUITS - RÈGLES IMPÉRATIVES :
- Quand un client demande à voir les produits disponibles, tu DOIS IMPÉRATIVEMENT appeler la fonction display_products avec la liste des produits
- Cette fonction affichera les produits visuellement dans le chat avec des boutons pour les ajouter au panier
- Après avoir appelé display_products, énumère AUSSI oralement quelques produits clés pour le client
- Sois PROACTIF : propose régulièrement des produits spécifiques adaptés aux besoins du client
- Suggère des produits complémentaires pour maximiser les ventes tout en restant éthique

Tu recommandes UNIQUEMENT les produits parapharmaceutiques disponibles dans la pharmacie sélectionnée ci-dessous.

En cas de doute médical, oriente vers le pharmacien ou médecin.${systemInstructions}`;

    clientSocket.onopen = () => {
      console.log('Client WebSocket connected');
      
      // Connect to OpenAI Realtime API with proper authentication
      const openaiUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`;

      // Use WebSocket subprotocols for authentication as recommended by OpenAI Realtime API
      // Format: ["realtime", `openai-insecure-api-key.${OPENAI_API_KEY}`, "openai-beta.realtime-v1"]
      openaiSocket = new WebSocket(openaiUrl, [
        "realtime",
        `openai-insecure-api-key.${OPENAI_API_KEY}`,
        "openai-beta.realtime-v1",
      ]);

      openaiSocket.onopen = () => {
        console.log('Connected to OpenAI, sending session config...');
        
        // Send session configuration (without authorization field)
        openaiSocket.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: baseInstructions,
            voice: 'echo',
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
            max_response_output_tokens: 4096,
            tools: [
              {
                type: 'function',
                name: 'display_products',
                description: 'Affiche visuellement les produits disponibles dans le chat avec leurs détails et un bouton pour les ajouter au panier. Utilise cette fonction quand le client demande à voir les produits disponibles.',
                parameters: {
                  type: 'object',
                  properties: {
                    products: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          brand: { type: 'string' },
                          category: { type: 'string' },
                          price: { type: 'number' },
                          description: { type: 'string' },
                          image_url: { type: 'string' }
                        }
                      }
                    }
                  },
                  required: ['products']
                }
              },
              {
                type: 'function',
                name: 'add_to_cart',
                description: 'Ajoute un produit au panier du client. Utilise cette fonction quand le client demande explicitement d\'ajouter un produit à son panier (par exemple "ajoute ce produit", "mets ça dans mon panier", etc.).',
                parameters: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string', description: 'ID du produit' },
                    name: { type: 'string', description: 'Nom du produit' },
                    brand: { type: 'string', description: 'Marque du produit' },
                    price: { type: 'number', description: 'Prix du produit' },
                    imageUrl: { type: 'string', description: 'URL de l\'image du produit' }
                  },
                  required: ['productId', 'name', 'brand', 'price']
                }
              }
            ],
            tool_choice: 'auto'
          }
        }));
        console.log('Session configuration sent');
      };

      openaiSocket.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data as string);
        console.log('OpenAI message type:', data.type);

        // Handle function calls
        if (data.type === 'response.function_call_arguments.done') {
          console.log('Function call:', data.name, data.arguments);
          
          if (data.name === 'display_products') {
            try {
              const args = JSON.parse(data.arguments);
              
              // Send function call result back to OpenAI
              openaiSocket.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: data.call_id,
                  output: JSON.stringify({ success: true, message: 'Produits affichés avec succès' })
                }
              }));
              
              // Also forward to client for UI display
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({
                  type: 'display_products',
                  products: args.products
                }));
              }
            } catch (error) {
              console.error('Error handling display_products:', error);
            }
          }
          
          if (data.name === 'add_to_cart') {
            try {
              const args = JSON.parse(data.arguments);
              
              // Send function call result back to OpenAI
              openaiSocket.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: data.call_id,
                  output: JSON.stringify({ success: true, message: 'Produit ajouté au panier avec succès' })
                }
              }));
              
              // Forward to client to add to cart
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({
                  type: 'add_to_cart',
                  product: args
                }));
              }
            } catch (error) {
              console.error('Error handling add_to_cart:', error);
            }
          }
        }

        // Forward all OpenAI messages to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data as string);
        }
      };

      openaiSocket.onerror = (error: Event) => {
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

    clientSocket.onmessage = (event: MessageEvent) => {
      console.log('Client message received');
      if (openaiSocket && openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.send(event.data as string);
      }
    };

    clientSocket.onerror = (error: Event) => {
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
