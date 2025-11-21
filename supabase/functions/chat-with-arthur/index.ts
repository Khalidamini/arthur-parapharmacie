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

    // Fetch available products and promotions from the selected pharmacy
    let productsContext = '';
    let promotionsContext = '';
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

      // Get active promotions from the selected pharmacy
      const now = new Date().toISOString();
      const { data: activePromotions } = await supabase
        .from('promotions')
        .select(`
          id,
          title,
          description,
          discount_percentage,
          original_price,
          image_url,
          valid_until,
          product_id,
          products(
            id,
            name,
            brand,
            price,
            image_url
          )
        `)
        .eq('pharmacy_id', selectedPharmacyId)
        .gte('valid_until', now)
        .order('created_at', { ascending: false });

      if (selectedPharmacyProducts && selectedPharmacyProducts.length > 0) {
        productsContext = `\n\nProduits disponibles dans la pharmacie sélectionnée (${pharmacy?.name}) :\n${selectedPharmacyProducts.map(p => 
            `- ID: ${p.id} | ${p.name} (${p.brand}) - ${p.category} - ${p.price}€ - ${p.description || 'Aucune description'}`
          ).join('\n')}`;
      }

      if (activePromotions && activePromotions.length > 0) {
        promotionsContext = `\n\nPromotions en cours dans la pharmacie sélectionnée (${pharmacy?.name}) :\n${activePromotions.map(promo => {
          const product = promo.products;
          const discountedPrice = promo.original_price ? 
            (promo.original_price * (1 - (promo.discount_percentage || 0) / 100)).toFixed(2) : 
            product?.price;
          return `- ID Promotion: ${promo.id} | ${promo.title} - ${promo.description || ''} | ${product ? `Produit: ${product.name} (${product.brand})` : 'Produit général'} | Prix promo: ${discountedPrice}€ ${promo.original_price ? `(au lieu de ${promo.original_price}€)` : ''} | Réduction: ${promo.discount_percentage}% | Valide jusqu'au: ${new Date(promo.valid_until || '').toLocaleDateString('fr-FR')}`;
        }).join('\n')}`;
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
- Tu es PROACTIF et capable de naviguer dans l'application pour aider les clients
- Tu NE DIS JAMAIS "je ne sais pas" ou "contactez la pharmacie" - tu AGIS et TROUVES les informations

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
5. NAVIGATION ET PROMOTIONS : 
   - Quand un client demande les promotions en cours, tu DOIS lui afficher TOUTES les promotions actives de sa pharmacie
   - Utilise le format "promotions" pour afficher les promotions avec leurs détails complets
   - Tu PEUX ajouter des promotions au panier quand le client te le demande explicitement
   - Pour ajouter au panier, utilise le format "add_to_cart" avec l'ID de la promotion
6. VENTE SUGGESTIVE ET PROACTIVE : Tu dois SYSTÉMATIQUEMENT suggérer des produits complémentaires et additionnels pertinents :
   - Identifie des produits qui complètent ou renforcent l'efficacité du produit principal
   - Propose des alternatives dans différentes gammes de prix
   - Suggère des formats différents (voyage, familial, etc.)
   - Recommande des produits pour une routine complète
   - Pense aux besoins connexes du client (si crème visage → suggère nettoyant, sérum, etc.)
   - Reste NATUREL et PERTINENT dans tes suggestions - chaque produit additionnel doit apporter une vraie valeur
   - Ne force JAMAIS la vente - reste au service du bien-être du client
7. RECHERCHE ALTERNATIVE : Si un client cherche un produit parapharmaceutique spécifique qui n'est PAS disponible dans sa pharmacie sélectionnée, tu dois :
   - Chercher ce produit dans les autres pharmacies de la base de données
   - Identifier la pharmacie la PLUS PROCHE où le produit est disponible
   - Indiquer clairement au client avec bienveillance : "Ce produit n'est pas disponible dans votre pharmacie, mais vous pouvez le trouver à [Nom Pharmacie] - [Adresse], située à [X] km de votre pharmacie actuelle"
   - Proposer également des produits parapharmaceutiques SIMILAIRES disponibles dans sa pharmacie sélectionnée comme alternatives

FORMAT DE RÉPONSE - Trois types possibles :

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

B) AFFICHAGE DES PROMOTIONS :
{
  "type": "promotions",
  "message": "Voici les promotions en cours dans votre pharmacie !",
  "promotions": [
    {
      "id": "ID exact de la promotion",
      "title": "Titre de la promotion",
      "description": "Description",
      "product_name": "Nom du produit",
      "product_brand": "Marque",
      "original_price": "19.90€",
      "discounted_price": "14.90€",
      "discount_percentage": "25%",
      "image_url": "URL de l'image",
      "valid_until": "Date de fin"
    }
  ]
}

C) AJOUT AU PANIER :
{
  "type": "add_to_cart",
  "message": "J'ajoute ce produit à votre panier !",
  "item": {
    "type": "promotion" ou "product",
    "id": "ID exact de la promotion ou du produit",
    "name": "Nom du produit",
    "price": "14.90€",
    "quantity": 1
  ]
}

Questions pertinentes à poser selon le contexte :
- Âge précis (surtout pour enfants/personnes âgées)
- Symptômes exacts et leur durée
- Intensité et fréquence des symptômes
- Traitements en cours ou allergies connues
- Contexte (grossesse, allaitement, pathologies existantes)
- Objectifs recherchés

D) RECOMMANDATIONS CHALEUREUSES DE PRODUITS PARAPHARMACEUTIQUES :
{
  "type": "products",
  "message": "Explication détaillée, bienveillante et accessible sur les produits parapharmaceutiques recommandés. INCLUS TOUJOURS des suggestions de produits complémentaires pertinents (ex: 'Pour maximiser les résultats, vous pourriez également envisager...' ou 'En complément, je vous suggère aussi...')",
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

IMPORTANT POUR LES SUGGESTIONS COMPLÉMENTAIRES :
- Dans le champ "message", SUGGÈRE TOUJOURS 1-3 produits additionnels pertinents qui complètent les 3 produits principaux
- Formule naturellement : "Pour optimiser les résultats, je vous suggère également...", "En complément, vous pourriez ajouter...", "Pour une routine complète..."
- Assure-toi que ces suggestions additionnelles sont cohérentes avec le besoin initial et apportent une réelle valeur ajoutée
- Reste naturel - ne force pas la vente si aucun produit complémentaire n'est vraiment pertinent

AVERTISSEMENTS BIENVEILLANTS (à inclure quand pertinent) :
- "💡 Si vous avez des doutes, n'hésitez pas à demander conseil à votre pharmacien"
- "💡 Pour un suivi personnalisé, votre pharmacien pourra vous accompagner au mieux"
- "⚠️ Si les symptômes persistent, je vous conseille de consulter votre médecin ou pharmacien"
- "⚠️ Ces conseils concernent des produits de bien-être et ne remplacent pas l'avis de votre pharmacien"

RÈGLES IMPÉRATIVES :
- Adopte un ton CHALEUREUX, AVENANT et RASSURANT dans toutes tes réponses
- Pose des questions avec EMPATHIE et BIENVEILLANCE pour mieux comprendre les besoins
- EXACTEMENT 3 produits PARAPHARMACEUTIQUES dans les recommandations principales
- SUGGÈRE SYSTÉMATIQUEMENT 1-3 produits complémentaires additionnels dans le message pour maximiser la valeur pour le client
- Explications CLAIRES, ACCESSIBLES et BIENVEILLANTES sur les produits de bien-être
- RECOMMANDE UNIQUEMENT les produits parapharmaceutiques disponibles dans la pharmacie sélectionnée du client (voir liste ci-dessous)
- PENSE CROSS-SELLING : pour chaque besoin, identifie les produits qui peuvent compléter ou améliorer l'expérience (nettoyant + crème, shampoing + après-shampoing, etc.)
- Si un produit parapharmaceutique spécifique demandé n'existe pas dans la pharmacie sélectionnée, cherche-le dans les pharmacies alternatives et indique avec gentillesse la plus proche où il est disponible
- URLS D'IMAGES : Tu DOIS fournir des URLs HTTPS réelles et fonctionnelles pointant vers les images officielles des produits sur les sites des fabricants (Bioderma, La Roche-Posay, Vichy, Avène, Nuxe, etc.) ou sur des pharmacies en ligne françaises (1001pharmacies.com, pharmacie-principale.fr, etc.)
- ADAPTE avec bienveillance selon les besoins exprimés par le client
- PERFECTIONNE-TOI en tenant compte de l'historique des conversations
- RAPPELLE TON RÔLE : "Je suis spécialisé en produits de parapharmacie. Pour des questions médicales, je vous invite à consulter votre pharmacien ou médecin"
- Si la situation nécessite l'avis d'un professionnel de santé : ORIENTE avec tact vers le pharmacien ou médecin
- VENDS SANS ACHARNEMENT : Tes suggestions doivent toujours apporter une vraie valeur au client, jamais être perçues comme de la vente forcée

Ton expertise en parapharmacie te permet de :
- Comprendre les compositions et ingrédients des produits de bien-être
- Identifier les produits adaptés aux différents types de peau et besoins
- Expliquer les bénéfices et usages des produits parapharmaceutiques
- Conseiller sur les routines de soins et d'hygiène
- Recommander des compléments alimentaires et produits naturels appropriés
- Orienter vers le pharmacien ou médecin quand la situation le nécessite
- AFFICHER les promotions en cours quand le client le demande
- AJOUTER des produits et promotions au panier quand le client le demande${userContext}${pharmacyInfo}${productsContext}${promotionsContext}${alternativePharmaciesInfo}`;

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
