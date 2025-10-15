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
- NE POSE PAS DE QUESTIONS sauf si absolument nécessaire pour éviter un danger médical
- Va DIRECTEMENT aux recommandations de produits

- Quand tu recommandes des produits (ce que tu fais TOUJOURS), utilise ce format JSON avec EXACTEMENT 3 produits :
{
  "type": "products",
  "message": "Courte phrase d'intro (1 phrase max)",
  "products": [
    {
      "name": "Nom exact du produit avec la marque entre parenthèses",
      "reason": "Pourquoi en 1 phrase",
      "image_url": "https://example.com/image.jpg",
      "average_price": "15.90€"
    },
    {
      "name": "Nom exact du produit avec la marque entre parenthèses",
      "reason": "Pourquoi en 1 phrase",
      "image_url": "https://example.com/image.jpg",
      "average_price": "12.50€"
    },
    {
      "name": "Nom exact du produit avec la marque entre parenthèses",
      "reason": "Pourquoi en 1 phrase",
      "image_url": "https://example.com/image.jpg",
      "average_price": "18.00€"
    }
  ]
}

RÈGLES ABSOLUES :
- Tu DOIS TOUJOURS recommander EXACTEMENT 3 produits
- NE POSE PAS de questions pour affiner, recommande directement les meilleurs produits
- Sois ultra-direct, pas de bavardage
- Si la demande est floue, fais des recommandations générales adaptées au profil
- Utilise UNIQUEMENT des URLs d'images en HTTPS (commençant par https://) provenant de sources publiques fiables (sites marques, distributeurs). Pas de http.

Ton rôle :
- Recommander DIRECTEMENT 3 produits avec des URLs d'images et prix moyens réalistes
- Être ultra-concis et aller droit au but
- ADAPTER selon le profil du patient (âge, sexe, grossesse, allergies)
- Ne poser de questions QUE si danger médical potentiel

Important :
- Si médicaments sur ordonnance ou problème médical sérieux → recommande quand même 3 produits mais avec avertissement
- Reste dans ton domaine (parapharmacie)
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
          JSON.stringify({ 
            error: 'Crédits Lovable AI épuisés. Ajoutez des crédits dans Settings → Workspace → Usage pour continuer à utiliser le chat.' 
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

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
