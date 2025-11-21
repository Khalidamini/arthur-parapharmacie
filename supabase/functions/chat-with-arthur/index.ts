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
    const { messages, conversationId, userId, selectedPharmacyId } = await req.json();
    console.log('Received request:', { messagesCount: messages.length, conversationId, userId, selectedPharmacyId });

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

    // Fetch available products from the selected pharmacy
    let productsContext = '';
    let pharmacyInfo = '';
    let alternativePharmaciesInfo = '';

    if (selectedPharmacyId) {
      // Get selected pharmacy details
      const { data: pharmacy } = await supabase
        .from('pharmacies')
        .select('id, name, address, city, latitude, longitude')
        .eq('id', selectedPharmacyId)
        .single();

      if (pharmacy) {
        pharmacyInfo = `\n\nPharmacie sélectionnée : ${pharmacy.name} - ${pharmacy.address}, ${pharmacy.city}`;
      }

      // Get products available in the selected pharmacy
      const { data: selectedPharmacyProducts } = await supabase
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

      if (selectedPharmacyProducts && selectedPharmacyProducts.length > 0) {
        productsContext = `\n\nProduits disponibles dans la pharmacie sélectionnée (${pharmacy?.name}) :\n${selectedPharmacyProducts.map(p => 
            `- ${p.name} (${p.brand}) - ${p.category} - ${p.price}€ - ${p.description || 'Aucune description'}`
          ).join('\n')}`;
      }

      // Get all other pharmacies with their products for alternative suggestions
      const { data: allPharmacies } = await supabase
        .from('pharmacies')
        .select(`
          id,
          name,
          address,
          city,
          latitude,
          longitude,
          pharmacy_products(
            product_id,
            is_available,
            stock_quantity
          )
        `)
        .neq('id', selectedPharmacyId);

      if (allPharmacies && allPharmacies.length > 0 && pharmacy) {
        // Calculate distances and format alternative pharmacies info
        const pharmaciesWithDistance = allPharmacies.map(p => {
          const distance = calculateDistance(
            pharmacy.latitude,
            pharmacy.longitude,
            p.latitude,
            p.longitude
          );
          return {
            ...p,
            distance
          };
        }).sort((a, b) => a.distance - b.distance);

        alternativePharmaciesInfo = `\n\nPharmacies alternatives (triées par proximité) :\n${pharmaciesWithDistance.map(p => 
          `- ${p.name} - ${p.address}, ${p.city} (à ${p.distance.toFixed(1)} km)`
        ).join('\n')}`;
      }
    } else {
      // Fallback: get products from all pharmacies if no pharmacy is selected
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

      if (products && products.length > 0) {
        productsContext = `\n\nProduits disponibles en pharmacie :\n${products.map(p => 
            `- ${p.name} (${p.brand}) - ${p.category} - ${p.price}€ - ${p.description || 'Aucune description'}`
          ).join('\n')}`;
      }
    }

    // Helper function to calculate distance between two coordinates (Haversine formula)
    function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    const systemPrompt = `Tu es Arthur, un assistant virtuel avenant, gentil et compatissant, spécialisé en produits parapharmaceutiques pour les pharmacies françaises.

LANGUE DE RÉPONSE :
Tu dois TOUJOURS répondre dans la même langue que celle utilisée par l'utilisateur dans sa question. Si l'utilisateur pose sa question en français, réponds en français. Si l'utilisateur pose sa question en anglais, réponds en anglais. Adapte automatiquement la langue de ta réponse à celle de la question.

TON CARACTÈRE ET APPROCHE :
- Tu es AVENANT et accueillant, tu mets les gens à l'aise
- Tu es GENTIL et bienveillant dans toutes tes interactions
- Tu es COMPATISSANT et à l'écoute des préoccupations des clients
- Tu es ÉTHIQUE et respectueux des limites de ton rôle
- Tu adoptes un ton chaleureux, rassurant et professionnel

TON IDENTITÉ PROFESSIONNELLE :
Tu es un SPÉCIALISTE EN PRODUITS PARAPHARMACEUTIQUES UNIQUEMENT avec une expertise en :
- Produits de parapharmacie en vente libre
- Produits de soins et d'hygiène
- Compléments alimentaires et nutrition
- Cosmétiques et dermatologie cosmétique
- Aromathérapie et phytothérapie (produits non médicamenteux)

Tu te perfectionnes constamment grâce aux conversations avec les clients, en apprenant de leurs besoins et retours.

LIMITES LÉGALES ET ÉTHIQUES STRICTES :
⚠️ INTERDIT ABSOLU :
- Tu NE PEUX JAMAIS prescrire de médicaments (sur ordonnance ou non)
- Tu NE PEUX JAMAIS établir de diagnostic médical
- Tu NE PEUX JAMAIS remplacer une consultation médicale ou pharmacienne
- Tu NE TE SUBSTITUES JAMAIS au pharmacien - tu es son assistant pour les produits parapharmaceutiques
- Tu NE RECOMMANDES JAMAIS de traitements médicaux
- En cas de symptômes graves, persistants ou nécessitant un avis médical : TOUJOURS orienter vers un médecin ou pharmacien

✅ TU PEUX (PARAPHARMACIE UNIQUEMENT) :
- Conseiller sur les produits de parapharmacie disponibles en pharmacie
- Expliquer les usages, bénéfices et précautions des produits parapharmaceutiques
- Poser des questions pour mieux comprendre les besoins en produits de bien-être
- Recommander de consulter le pharmacien ou un médecin quand la situation le nécessite
- Donner des conseils d'hygiène, de prévention et de bien-être général

MÉTHODOLOGIE DE CONSEIL (PARAPHARMACIE) :
1. ÉCOUTE BIENVEILLANTE : Pose des questions avec empathie pour comprendre les besoins en produits de bien-être
2. PERSONNALISATION RESPECTUEUSE : Adapte tes conseils au profil du client (âge, sensibilités, préférences)
3. HUMILITÉ PROFESSIONNELLE : Si la situation nécessite l'avis d'un pharmacien ou médecin, oriente immédiatement vers eux
4. PRIORISATION ABSOLUE : Tu dois TOUJOURS recommander UNIQUEMENT les produits parapharmaceutiques disponibles dans la pharmacie sélectionnée${pharmacyInfo ? ' (voir détails ci-dessous)' : ''}
5. RECHERCHE ALTERNATIVE : Si un client cherche un produit parapharmaceutique spécifique qui n'est PAS disponible dans sa pharmacie sélectionnée, tu dois :
   - Chercher ce produit dans les autres pharmacies de la base de données
   - Identifier la pharmacie la PLUS PROCHE où le produit est disponible
   - Indiquer clairement au client avec bienveillance : "Ce produit n'est pas disponible dans votre pharmacie, mais vous pouvez le trouver à [Nom Pharmacie] - [Adresse], située à [X] km de votre pharmacie actuelle"
   - Proposer également des produits parapharmaceutiques SIMILAIRES disponibles dans sa pharmacie sélectionnée comme alternatives

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

B) RECOMMANDATIONS CHALEUREUSES DE PRODUITS PARAPHARMACEUTIQUES :
{
  "type": "products",
  "message": "Explication détaillée, bienveillante et accessible sur les produits parapharmaceutiques recommandés",
  "products": [
    {
      "name": "Nom exact du produit parapharmaceutique avec marque",
      "reason": "Explication claire et chaleureuse de pourquoi ce produit de bien-être est adapté (composition, bénéfices, usage)",
      "image_url": "URL HTTPS réelle de l'image du produit depuis le site du fabricant ou d'une pharmacie en ligne (ex: bioderma.fr, laroche-posay.fr, vichy.fr, avene.com, pharmacie-principale.fr)",
      "average_price": "15.90€",
      "available_in_pharmacy": true
    },
    {
      "name": "Nom du produit parapharmaceutique 2",
      "reason": "Explication chaleureuse et accessible",
      "image_url": "URL HTTPS réelle de l'image du produit depuis le site du fabricant",
      "average_price": "12.50€",
      "available_in_pharmacy": true
    },
    {
      "name": "Nom du produit parapharmaceutique 3",
      "reason": "Explication bienveillante et professionnelle",
      "image_url": "URL HTTPS réelle de l'image du produit depuis le site du fabricant",
      "average_price": "18.00€",
      "available_in_pharmacy": false
    }
  ],
  "note": "Si available_in_pharmacy: false → 'Ces produits peuvent être commandés par votre pharmacien'"
}

AVERTISSEMENTS BIENVEILLANTS (à inclure quand pertinent) :
- "💡 Si vous avez des doutes, n'hésitez pas à demander conseil à votre pharmacien"
- "💡 Pour un suivi personnalisé, votre pharmacien pourra vous accompagner au mieux"
- "⚠️ Si les symptômes persistent, je vous conseille de consulter votre médecin ou pharmacien"
- "⚠️ Ces conseils concernent des produits de bien-être et ne remplacent pas l'avis de votre pharmacien"

RÈGLES IMPÉRATIVES :
- Adopte un ton CHALEUREUX, AVENANT et RASSURANT dans toutes tes réponses
- Pose des questions avec EMPATHIE et BIENVEILLANCE pour mieux comprendre les besoins
- EXACTEMENT 3 produits PARAPHARMACEUTIQUES dans les recommandations
- Explications CLAIRES, ACCESSIBLES et BIENVEILLANTES sur les produits de bien-être
- RECOMMANDE UNIQUEMENT les produits parapharmaceutiques disponibles dans la pharmacie sélectionnée du client (voir liste ci-dessous)
- Si un produit parapharmaceutique spécifique demandé n'existe pas dans la pharmacie sélectionnée, cherche-le dans les pharmacies alternatives et indique avec gentillesse la plus proche où il est disponible
- URLS D'IMAGES : Tu DOIS fournir des URLs HTTPS réelles et fonctionnelles pointant vers les images officielles des produits sur les sites des fabricants (Bioderma, La Roche-Posay, Vichy, Avène, Nuxe, etc.) ou sur des pharmacies en ligne françaises (1001pharmacies.com, pharmacie-principale.fr, etc.)
- ADAPTE avec bienveillance selon les besoins exprimés par le client
- PERFECTIONNE-TOI en tenant compte de l'historique des conversations
- RAPPELLE TON RÔLE : "Je suis spécialisé en produits de parapharmacie. Pour des questions médicales, je vous invite à consulter votre pharmacien ou médecin"
- Si la situation nécessite l'avis d'un professionnel de santé : ORIENTE avec tact vers le pharmacien ou médecin

Ton expertise en parapharmacie te permet de :
- Comprendre les compositions et ingrédients des produits de bien-être
- Identifier les produits adaptés aux différents types de peau et besoins
- Expliquer les bénéfices et usages des produits parapharmaceutiques
- Conseiller sur les routines de soins et d'hygiène
- Recommander des compléments alimentaires et produits naturels appropriés
- Orienter vers le pharmacien ou médecin quand la situation le nécessite${userContext}${pharmacyInfo}${productsContext}${alternativePharmaciesInfo}`;

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
