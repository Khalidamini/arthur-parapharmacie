import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
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

MÉTHODOLOGIE DE CONSEIL :
1. TOUJOURS poser des questions pertinentes pour mieux comprendre les besoins du patient
2. Prioriser ABSOLUMENT les produits disponibles dans la pharmacie référente${productsContext ? ' (voir liste ci-dessous)' : ''}
3. Si aucun produit disponible ne convient, recommander des produits que le pharmacien pourra commander

FORMAT DE RÉPONSE - Deux types possibles :

A) QUESTIONS (à utiliser en premier pour affiner le diagnostic) :
{
  "type": "question",
  "question": "Question claire et précise",
  "options": [
    "Option 1",
    "Option 2",
    "Option 3",
    "Option 4"
  ]
}

B) RECOMMANDATIONS DE PRODUITS (après avoir posé les questions nécessaires) :
{
  "type": "products",
  "message": "Explication personnalisée basée sur les réponses",
  "products": [
    {
      "name": "Nom exact du produit avec marque",
      "reason": "Pourquoi ce produit convient au patient",
      "image_url": "https://example.com/image.jpg",
      "average_price": "15.90€",
      "available_in_pharmacy": true
    },
    {
      "name": "Nom du produit 2",
      "reason": "Raison",
      "image_url": "https://example.com/image.jpg",
      "average_price": "12.50€",
      "available_in_pharmacy": true
    },
    {
      "name": "Nom du produit 3",
      "reason": "Raison",
      "image_url": "https://example.com/image.jpg",
      "average_price": "18.00€",
      "available_in_pharmacy": false
    }
  ],
  "note": "Si available_in_pharmacy: false, ajouter : 'Ces produits peuvent être commandés par votre pharmacien'"
}

RÈGLES IMPÉRATIVES :
- POSE DES QUESTIONS pour affiner (âge exact si enfant, symptômes précis, durée, intensité, antécédents, traitements en cours)
- Utilise tes connaissances approfondies en santé et parapharmacie
- PRIORISE les produits de la liste de la pharmacie référente
- Si produits non disponibles, propose des alternatives que le pharmacien peut commander
- Adapte selon le profil patient (âge, sexe, grossesse, allergies, antécédents)
- Utilise UNIQUEMENT des URLs HTTPS d'images provenant de sources fiables
- EXACTEMENT 3 produits dans les recommandations
- Si danger médical : pose des questions de sécurité AVANT de recommander

Ton expertise :
- Connaissance approfondie des produits de parapharmacie
- Capacité à poser les bonnes questions diagnostiques
- Recommandations personnalisées et sécuritaires
- Priorisation des produits disponibles en pharmacie${userContext}${productsContext}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        const isQuotaError = errorData?.error?.code === 'insufficient_quota';
        
        return new Response(
          JSON.stringify({ 
            error: isQuotaError 
              ? 'Quota OpenAI dépassé. Ajoutez des crédits sur platform.openai.com/account/billing'
              : 'Trop de requêtes OpenAI, veuillez réessayer dans quelques instants.'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Clé API OpenAI invalide. Vérifiez votre configuration.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
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
