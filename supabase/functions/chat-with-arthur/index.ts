import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize query for cache matching
function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:\s]+/g, ' ')
    .replace(/\s+/g, ' ');
}

// Generate hash for cache key
async function generateQueryHash(normalizedQuery: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(normalizedQuery);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return encodeHex(hashBuffer);
}

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
        const profil = [];
        if (profile.gender) profil.push(`Sexe:${profile.gender}`);
        if (profile.age) profil.push(`${profile.age}ans`);
        if (profile.gender === 'femme' && profile.is_pregnant) profil.push('Enceinte');
        if (profile.allergies) profil.push(`Allergies:${profile.allergies}`);
        if (profile.medical_history) profil.push(`Antéc:${profile.medical_history}`);
        if (profil.length > 0) {
          userContext = `\n\nPROFIL : ${profil.join('|')} → Adapte conseils`;
        }
      }
    }

    // Fetch conversation history if conversationId is provided (limited for cost optimization)
    let fullMessages = messages;
    if (conversationId) {
      const { data: historyMessages, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(8);

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
        pharmacyInfo = `\n\nPHARMACIE : ${pharmacy.name}|${pharmacy.address}, ${pharmacy.city}`;
      }

      // Get products available in the selected pharmacy (limited for cost optimization)
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
        .limit(35);

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
        productsContext = `\n\nPRODUITS DISPO (${pharmacy?.name}) :\n${selectedPharmacyProducts.slice(0, 50).map(p => 
            `ID:${p.id}|${p.name}|${p.brand}|${p.category}|${p.price}€|${(p.description || '').substring(0, 50)}`
          ).join('\n')}`;
      }

      if (activePromotions && activePromotions.length > 0) {
        promotionsContext = `\n\nPROMOS ACTIVES (${pharmacy?.name}) :\n${activePromotions.map(promo => {
          const product = promo.products;
          const discountedPrice = promo.original_price ? 
            (promo.original_price * (1 - (promo.discount_percentage || 0) / 100)).toFixed(2) : 
            product?.price;
          return `ID:${promo.id}|${promo.title}|${product?.name || 'Général'}|${product?.brand || ''}|${discountedPrice}€ (-${promo.discount_percentage}%)|Fin:${new Date(promo.valid_until || '').toLocaleDateString('fr-FR')}`;
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

        alternativePharmaciesInfo = `\n\nAUTRES PHARMACIES (par distance) :\n${pharmaciesWithDistance.slice(0, 5).map(p => 
          `${p.name}|${p.address}, ${p.city}|${p.distance.toFixed(1)}km`
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

const systemPrompt = `Tu es Arthur, assistant parapharmaceutique. Réponds dans la langue du client.

PERSONNALITÉ : Avenant, gentil, compatissant, éthique, NATUREL. Parle comme un humain.

JAMAIS : "je ne sais pas" ou "contactez la pharmacie" → AGIS et TROUVE

STYLE VOCAL :
- Conversationnel et décontracté (pas formel/robotique)
- Phrases courtes (5-10 mots)
- Langage naturel avec "euh", "alors", "voyons"
- Questions de suivi pour engager
- Empathie ("Je comprends", "Ah oui")

EXPERTISE PARAPHARMACIE : Soins, hygiène, compléments, cosmétiques (PAS médicaments/diagnostic).

GUIDE APPLICATION : Clients (promo/achat) ET Pharmaciens (gestion). Navigation vocale fluide.

PAGES DISPONIBLES DANS L'APPLICATION :

POUR LES CLIENTS :
- /shop : Boutique avec tous les produits disponibles
- /promotions : Page des promotions en cours
- /cart : Panier d'achats
- /my-orders : Historique des commandes
- /pharmacies : Liste des pharmacies disponibles
- /recommendations : Recommandations personnalisées
- /scan-qr : Scanner un QR code de pharmacie
- /checkout/:cartId : Page de paiement

POUR LES PHARMACIENS :
- /pharmacy-dashboard : Tableau de bord principal
- /pharmacy-profile : Profil et informations de la pharmacie
- /pharmacy-pickup-orders : Commandes à emporter
- /pharmacy-delivery-orders : Commandes à livrer
- /pharmacy-connector-download : Télécharger le connecteur

LIMITES STRICTES :
⚠️ INTERDIT : Prescrire, diagnostiquer, remplacer médecin/pharmacien, traitement médical.
✅ AUTORISÉ : Conseiller parapharmacie, expliquer usages, orienter si besoin médical.

MÉTHODOLOGIE :
1. Écoute empathique + questions ciblées (âge, symptômes, durée, allergies, contexte)
2. Personnalise selon profil${userContext ? ' (voir PROFIL ci-dessous)' : ''}
3. Recommande UNIQUEMENT produits dispo pharmacie sélectionnée${pharmacyInfo ? ' (voir ci-dessous)' : ''}
4. Vente suggestive NATURELLE : compléments pertinents, routine complète, alternatives prix
5. Si indispo : cherche autre pharmacie + suggère alternatives locales
6. Navigation active : utilise "navigate" pour rediriger (clients vers /shop, /promotions, /cart, /my-orders ; pharmaciens vers /pharmacy-dashboard, /pharmacy-pickup-orders, etc.)
7. Promotions : affiche TOUTES avec format "promotions", ajoute au panier avec ID exact
8. Urgence médicale → oriente vers médecin/pharmacien

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
  }
}

D) NAVIGATION DANS L'APPLICATION :
{
  "type": "navigate",
  "message": "Je vous redirige vers [nom de la page]",
  "page": "URL de la page (ex: /pharmacy-dashboard, /shop, /promotions)",
  "guidance": "Instructions supplémentaires pour guider l'utilisateur une fois sur la page"
}

Questions pertinentes à poser selon le contexte :
- Âge précis (surtout pour enfants/personnes âgées)
- Symptômes exacts et leur durée
- Intensité et fréquence des symptômes
- Traitements en cours ou allergies connues
- Contexte (grossesse, allaitement, pathologies existantes)
- Objectifs recherchés

E) RECOMMANDATIONS CHALEUREUSES DE PRODUITS PARAPHARMACEUTIQUES :
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
- AJOUTER des produits et promotions au panier quand le client le demande
- GUIDER les utilisateurs dans l'application en les redirigeant vers les bonnes pages
- ACCOMPAGNER vocalement les utilisateurs même pendant la navigation entre pages
- NE JAMAIS dire "je ne sais pas" ou "contactez la pharmacie" - toujours proposer une solution${userContext}${pharmacyInfo}${productsContext}${promotionsContext}${alternativePharmaciesInfo}`;

    // Check cache for simple queries (short conversations with no complex context)
    const lastUserMessage = fullMessages.filter((m: any) => m.role === 'user').pop();
    
    if (lastUserMessage?.content && fullMessages.length <= 3) {
      const normalizedQuery = normalizeQuery(lastUserMessage.content);
      const queryHash = await generateQueryHash(normalizedQuery);

      const { data: cachedResponse } = await supabase
        .from('arthur_response_cache')
        .select('response_text, id, hit_count')
        .eq('query_hash', queryHash)
        .single();

      if (cachedResponse) {
        console.log('✅ Cache hit! Returning cached response (hit count:', cachedResponse.hit_count, ')');
        
        // Update cache statistics
        await supabase
          .from('arthur_response_cache')
          .update({
            hit_count: cachedResponse.hit_count + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', cachedResponse.id);

        return new Response(
          JSON.stringify({ 
            message: cachedResponse.response_text,
            fromCache: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('❌ Cache miss, calling OpenAI API');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...fullMessages
        ],
        temperature: 0.7,
        max_tokens: 250,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Trop de requêtes OpenAI, veuillez réessayer dans quelques instants.'
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

    // Save to cache if it's a simple Q&A (short response, not too complex conversation)
    if (lastUserMessage?.content && assistantMessage.length < 2000 && fullMessages.length <= 3) {
      const normalizedQuery = normalizeQuery(lastUserMessage.content);
      const queryHash = await generateQueryHash(normalizedQuery);

      const { error: cacheError } = await supabase
        .from('arthur_response_cache')
        .upsert({
          query_normalized: normalizedQuery,
          query_hash: queryHash,
          response_text: assistantMessage,
          context_type: 'general',
          hit_count: 1,
          last_used_at: new Date().toISOString()
        }, { onConflict: 'query_hash' });

      if (cacheError) {
        console.error('❌ Cache save error:', cacheError);
      } else {
        console.log('✅ Response cached successfully');
      }
    }

    return new Response(
      JSON.stringify({ 
        message: assistantMessage,
        fromCache: false 
      }),
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
