import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, userId } = await req.json();
    console.log('Received request:', { messagesCount: messages.length, conversationId, userId });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user profile for personalization
    let userContext = '';
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender, age, is_pregnant, allergies, medical_history')
        .eq('id', userId)
        .single();

      if (profile) {
        userContext = `\n\nInformations du patient :
- Sexe : ${profile.gender || 'non renseigné'}
- Âge : ${profile.age ? `${profile.age} ans` : 'non renseigné'}
${profile.gender === 'femme' && profile.is_pregnant ? '- Enceinte : Oui\n' : ''}${profile.allergies ? `- Allergies : ${profile.allergies}\n` : ''}${profile.medical_history ? `- Antécédents médicaux : ${profile.medical_history}\n` : ''}
Adapte tes recommandations en fonction de ces informations.`;
      }
    }

    // Fetch conversation history if conversationId is provided
    let fullMessages = messages;
    if (conversationId) {
      const { data: historyMessages, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching conversation history:', error);
      } else if (historyMessages && historyMessages.length > 0) {
        fullMessages = [...historyMessages, ...messages];
        console.log('Added conversation history:', historyMessages.length, 'messages');
      }
    }

    // Fetch available products from database for context
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
      .eq('pharmacy_products.is_available', true)
      .gt('pharmacy_products.stock_quantity', 0)
      .limit(50);

    // Format products for AI context
    const productsContext = products && products.length > 0 
      ? `\n\nProduits disponibles en pharmacie :\n${products.map(p => 
          `- ${p.name} (${p.brand}) - ${p.category} - ${p.price}€ - ${p.description || 'Aucune description'}`
        ).join('\n')}`
      : '';

    const systemPrompt = `Tu es Arthur, un assistant virtuel expert en parapharmacie pour les pharmacies françaises.

IMPÉRATIF - Format de réponse :
- Sois TRÈS CONCIS et direct (max 2-3 phrases courtes)
- Quand tu poses des questions, utilise ce format JSON pour proposer des options à cocher :
{
  "type": "question",
  "question": "Ta question courte ?",
  "options": ["Option 1", "Option 2", "Option 3"]
}

- Quand tu recommandes des produits, utilise ce format JSON avec EXACTEMENT 3 produits :
{
  "type": "products",
  "message": "Courte phrase d'intro",
  "products": [
    {
      "name": "Nom exact du produit 1",
      "reason": "Pourquoi en 1 phrase",
      "image_url": "URL de l'image du produit",
      "average_price": "Prix moyen en €"
    },
    {
      "name": "Nom exact du produit 2",
      "reason": "Pourquoi en 1 phrase",
      "image_url": "URL de l'image du produit",
      "average_price": "Prix moyen en €"
    },
    {
      "name": "Nom exact du produit 3",
      "reason": "Pourquoi en 1 phrase",
      "image_url": "URL de l'image du produit",
      "average_price": "Prix moyen en €"
    }
  ]
}

RÈGLE ABSOLUE : Tu DOIS TOUJOURS recommander EXACTEMENT 3 produits, jamais plus, jamais moins.

IMPORTANT : Pour chaque produit recommandé, tu DOIS rechercher son image et son prix moyen sur le web en utilisant la fonction search_product_info.

Ton rôle :
- Écouter et poser 1-2 questions MAXIMUM avec des options à cocher
- Recommander TOUJOURS 3 produits avec leurs images et prix moyens
- Être ultra-concis, empathique et professionnel
- ADAPTER selon le profil du patient (âge, sexe, grossesse, allergies)

Important :
- Si médicaments sur ordonnance ou problème médical sérieux → recommande de consulter un pharmacien
- Reste dans ton domaine (parapharmacie)
- Utilise les formats JSON ci-dessus pour questions et recommandations
- TOUJOURS inclure une image_url et average_price pour chaque produit${userContext}${productsContext}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...fullMessages
        ],
        temperature: 0.7,
        max_tokens: 1000,
        tools: [
          {
            type: "function",
            function: {
              name: "search_product_info",
              description: "Rechercher l'image et le prix moyen d'un produit de parapharmacie sur le web",
              parameters: {
                type: "object",
                properties: {
                  product_name: {
                    type: "string",
                    description: "Le nom du produit à rechercher"
                  }
                },
                required: ["product_name"]
              }
            }
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Trop de requêtes, veuillez réessayer dans quelques instants.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service temporairement indisponible. Veuillez contacter le support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    let assistantMessage = data.choices[0].message.content;

    // Handle tool calls if any
    const toolCalls = data.choices[0].message.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      console.log('Processing tool calls:', toolCalls);
      
      // For now, we'll extract product info from tool calls and include it in the response
      // In a more advanced implementation, you could actually make web searches here
      const productSearches = toolCalls.map((call: any) => {
        if (call.function.name === 'search_product_info') {
          const args = JSON.parse(call.function.arguments);
          return args.product_name;
        }
        return null;
      }).filter(Boolean);
      
      if (productSearches.length > 0) {
        console.log('Products to search:', productSearches);
        // Note: The AI will include the search results in its response
      }
    }

    console.log('Successfully generated response');

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat-with-arthur:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Une erreur est survenue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
