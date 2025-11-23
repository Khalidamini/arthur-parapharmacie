import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, userId, selectedPharmacyId, conversationId } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build system instructions with user context
    let systemInstructions = `Tu es Arthur, assistant vocal avenant, gentil et compatissant, spécialisé en produits parapharmaceutiques.

Tu communiques de vive voix avec les clients dans leur langue (français, anglais, etc.). Adapte automatiquement ta langue à celle du client.

TON CARACTÈRE :
- AVENANT et accueillant
- GENTIL et bienveillant
- COMPATISSANT et à l'écoute
- Ton CHALEUREUX et RASSURANT

TU ES SPÉCIALISTE EN PARAPHARMACIE UNIQUEMENT. Tu NE prescris JAMAIS de médicaments, tu NE fais JAMAIS de diagnostic médical, tu NE remplaces JAMAIS le pharmacien ou médecin.

RÈGLES IMPÉRATIVES :
- Sois PROACTIF : propose régulièrement des produits spécifiques adaptés aux besoins du client
- Suggère des produits complémentaires pour maximiser les ventes tout en restant éthique
- Si un produit n'est PAS disponible dans la pharmacie sélectionnée, indique les pharmacies où il est disponible
- En cas de doute médical, oriente vers le pharmacien ou médecin`;

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

    // Get conversation history
    const messages = [{ role: 'system', content: systemInstructions }];
    
    if (conversationId) {
      const { data: history } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);

      if (history) {
        messages.push(...history.map((m: any) => ({ role: m.role, content: m.content })));
      }
    }

    messages.push({ role: 'user', content: message });

    // Define tools
    const tools = [
      {
        type: 'function',
        function: {
          name: 'display_products',
          description: 'Affiche visuellement les produits disponibles. Utilise cette fonction quand le client demande à voir les produits.',
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
        }
      },
      {
        type: 'function',
        function: {
          name: 'add_to_cart',
          description: 'Ajoute un produit au panier. Utilise quand le client demande explicitement d\'ajouter un produit.',
          parameters: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              name: { type: 'string' },
              brand: { type: 'string' },
              price: { type: 'number' },
              imageUrl: { type: 'string' }
            },
            required: ['productId', 'name', 'brand', 'price']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_all_pharmacies',
          description: 'Recherche un produit dans toutes les pharmacies. Utilise quand le produit n\'est pas disponible dans la pharmacie sélectionnée.',
          parameters: {
            type: 'object',
            properties: {
              productName: { type: 'string' }
            },
            required: ['productName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'navigate',
          description: 'Guide l\'utilisateur vers une page spécifique de l\'application.',
          parameters: {
            type: 'object',
            properties: {
              page: { type: 'string', description: 'shop, promotions, cart, recommendations, etc.' },
              message: { type: 'string' },
              guidance: { type: 'string' }
            },
            required: ['page']
          }
        }
      }
    ];

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error('Failed to get response from OpenAI');
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message;

    // Handle tool calls
    const toolCalls = [];
    if (assistantMessage.tool_calls) {
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        if (functionName === 'search_all_pharmacies') {
          const { data: results } = await supabase
            .from('products')
            .select(`
              id, name, brand, category, price, image_url,
              pharmacy_products!inner(
                pharmacy_id, stock_quantity, is_available,
                pharmacies!inner(name, address, city, postal_code)
              )
            `)
            .ilike('name', `%${args.productName}%`)
            .eq('pharmacy_products.is_available', true)
            .gt('pharmacy_products.stock_quantity', 0);

          const pharmacyResults = results?.map(p => ({
            productName: p.name,
            brand: p.brand,
            price: p.price,
            pharmacyName: (p.pharmacy_products as any)[0]?.pharmacies?.name,
            pharmacyAddress: (p.pharmacy_products as any)[0]?.pharmacies?.address,
            pharmacyCity: (p.pharmacy_products as any)[0]?.pharmacies?.city
          })) || [];

          toolCalls.push({
            type: 'search_results',
            results: pharmacyResults
          });
        } else {
          toolCalls.push({
            type: functionName,
            data: args
          });
        }
      }
    }

    // Save to conversation history
    if (conversationId) {
      await supabase.from('messages').insert([
        { conversation_id: conversationId, role: 'user', content: message },
        { conversation_id: conversationId, role: 'assistant', content: assistantMessage.content || '' }
      ]);
    }

    return new Response(
      JSON.stringify({
        text: assistantMessage.content || '',
        toolCalls
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in voice-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});