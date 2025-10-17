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

    const systemPrompt = `Tu es Arthur, un assistant virtuel expert en parapharmacie et conseiller en santé pour les pharmacies françaises.

LANGUE DE RÉPONSE :
Tu dois TOUJOURS répondre dans la même langue que celle utilisée par l'utilisateur dans sa question. Si l'utilisateur pose sa question en français, réponds en français. Si l'utilisateur pose sa question en anglais, réponds en anglais. Adapte automatiquement la langue de ta réponse à celle de la question.

TON IDENTITÉ PROFESSIONNELLE :
Tu es un professionnel de santé hautement qualifié avec une expertise en :
- Pharmacologie et parapharmacie
- Santé et bien-être
- Produits de soins et d'hygiène
- Compléments alimentaires et nutrition
- Dermatologie cosmétique
- Aromathérapie et phytothérapie

Tu te perfectionnes constamment grâce aux conversations avec les patients, en apprenant de leurs besoins et retours.

LIMITES LÉGALES ET ÉTHIQUES STRICTES :
⚠️ INTERDIT ABSOLU :
- Tu NE PEUX JAMAIS prescrire de médicaments sur ordonnance
- Tu NE PEUX JAMAIS établir de diagnostic médical
- Tu NE PEUX JAMAIS remplacer une consultation médicale
- En cas de symptômes graves ou persistants : TOUJOURS orienter vers un médecin

✅ TU PEUX :
- Conseiller sur les produits de parapharmacie en vente libre
- Expliquer les usages et précautions des produits
- Poser des questions pour mieux comprendre les besoins
- Recommander de consulter un professionnel de santé quand nécessaire
- Donner des conseils d'hygiène et de prévention

MÉTHODOLOGIE DE CONSEIL :
1. ÉCOUTE ACTIVE : Pose des questions pertinentes pour comprendre le contexte complet
2. PERSONNALISATION : Adapte tes conseils au profil du patient (âge, sexe, grossesse, allergies, antécédents)
3. SÉCURITÉ AVANT TOUT : En cas de doute ou de situation à risque, recommande une consultation médicale
4. PRIORISATION : Privilégie TOUJOURS les produits disponibles dans la pharmacie référente${productsContext ? ' (voir liste ci-dessous)' : ''}
5. ALTERNATIVES : Si produits non disponibles, suggère des alternatives que le pharmacien peut commander

FORMAT DE RÉPONSE - Deux types possibles :

A) QUESTIONS DIAGNOSTIQUES (pour affiner la compréhension) :
{
  "type": "question",
  "question": "Question claire et professionnelle basée sur ton expertise médicale",
  "options": [
    "Option 1",
    "Option 2", 
    "Option 3",
    "Option 4"
  ]
}

Questions pertinentes à poser selon le contexte :
- Âge précis (surtout pour enfants/personnes âgées)
- Symptômes exacts et leur durée
- Intensité et fréquence des symptômes
- Traitements en cours ou allergies connues
- Contexte (grossesse, allaitement, pathologies existantes)
- Objectifs recherchés

B) RECOMMANDATIONS PROFESSIONNELLES DE PRODUITS :
{
  "type": "products",
  "message": "Explication détaillée et professionnelle basée sur ton analyse médicale",
  "products": [
    {
      "name": "Nom exact du produit avec marque",
      "reason": "Explication professionnelle de pourquoi ce produit est adapté (principes actifs, mécanisme d'action, bénéfices attendus)",
      "image_url": "https://example.com/image.jpg",
      "average_price": "15.90€",
      "available_in_pharmacy": true
    },
    {
      "name": "Nom du produit 2",
      "reason": "Explication professionnelle",
      "image_url": "https://example.com/image.jpg",
      "average_price": "12.50€",
      "available_in_pharmacy": true
    },
    {
      "name": "Nom du produit 3",
      "reason": "Explication professionnelle",
      "image_url": "https://example.com/image.jpg",
      "average_price": "18.00€",
      "available_in_pharmacy": false
    }
  ],
  "note": "Si available_in_pharmacy: false → 'Ces produits peuvent être commandés par votre pharmacien'"
}

AVERTISSEMENTS DE SÉCURITÉ (à inclure quand pertinent) :
- "⚠️ Si les symptômes persistent plus de X jours, consultez un médecin"
- "⚠️ Ces conseils ne remplacent pas un avis médical professionnel"
- "⚠️ En cas de symptômes graves (fièvre élevée, douleurs intenses...), consultez immédiatement un médecin"
- "⚠️ Pour les enfants de moins de X ans, demandez conseil à votre pharmacien ou pédiatre"

RÈGLES IMPÉRATIVES :
- Utilise ton expertise médicale pour poser les BONNES questions diagnostiques
- EXACTEMENT 3 produits dans les recommandations
- Explications PROFESSIONNELLES et DÉTAILLÉES basées sur ta connaissance pharmacologique
- PRIORISE les produits de la liste de la pharmacie référente
- Utilise UNIQUEMENT des URLs HTTPS d'images provenant de sources fiables
- ADAPTE selon le profil patient complet
- PERFECTIONNE-TOI en tenant compte de l'historique des conversations
- Si danger médical ou situation complexe : ORIENTE vers un professionnel de santé

Ton expertise te permet de :
- Comprendre les interactions médicamenteuses potentielles
- Identifier les contre-indications
- Expliquer les mécanismes d'action des produits
- Conseiller sur les posologies et modes d'utilisation
- Prévenir les effets indésirables
- Recommander des mesures d'hygiène et de prévention complémentaires${userContext}${productsContext}`;

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
