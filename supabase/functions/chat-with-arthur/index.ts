import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════
// 🧠 SYSTÈME RAG - Arthur apprend de chaque conversation
// ═══════════════════════════════════════════════════════

/**
 * Normalise une question pour la recherche dans la base de connaissances
 * Retire la ponctuation, met en minuscules, corrige les erreurs courantes
 */
function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/c[4']est/g, 'cest') // Corrige "c'est" et "c4est"
    .replace(/qu[4']est/g, 'quest') // Corrige "qu'est" et "qu4est"
    .replace(/l[4']application/g, 'lapplication') // Corrige "l'application"
    .replace(/int[eé]r[eê]t/g, 'interet') // Corrige "intérêt"
    .replace(/[^\w\s]/g, ' ') // Retire la ponctuation restante
    .replace(/\s+/g, ' ') // Normalise les espaces
    .trim();
}

/**
 * Recherche dans la base de connaissances d'Arthur
 * Retourne la meilleure réponse trouvée ou null
 */
async function searchKnowledgeBase(
  supabase: any,
  userQuery: string,
  contextType: string,
  pharmacyId: string | null,
  similarityThreshold = 0.65
): Promise<{ response: any; knowledgeId: string; score: number } | null> {
  const normalized = normalizeQuery(userQuery);
  
  console.log('🔍 RAG: Recherche dans la base de connaissances...', {
    original: userQuery.substring(0, 100),
    normalized: normalized.substring(0, 100),
    contextType,
    pharmacyId: pharmacyId?.substring(0, 8),
    threshold: similarityThreshold
  });

  try {
    const { data: results, error } = await supabase.rpc('search_arthur_knowledge', {
      query_text: normalized,
      context_type_filter: contextType,
      pharmacy_id_filter: pharmacyId,
      similarity_threshold: similarityThreshold,
      limit_results: 1
    });

    if (error) {
      console.error('❌ RAG: Erreur de recherche:', error);
      return null;
    }

    if (!results || results.length === 0) {
      console.log('🔍 RAG: Aucune réponse trouvée dans la base de connaissances', {
        threshold: similarityThreshold,
        contextType
      });
      return null;
    }

    const bestMatch = results[0];
    console.log('✅ RAG: Réponse trouvée!', {
      score: bestMatch.similarity_score,
      usageCount: bestMatch.usage_count,
      confidence: bestMatch.confidence_score,
      question: bestMatch.question_original.substring(0, 100)
    });

    // Construire la réponse depuis la base de connaissances
    let response: any;
    try {
      response = JSON.parse(bestMatch.response_text);
      
      // Si la réponse a des métadonnées (produits), les ajouter
      if (bestMatch.response_metadata) {
        response = { ...response, ...bestMatch.response_metadata };
      }
    } catch {
      // Si ce n'est pas du JSON, c'est un message simple
      response = {
        type: 'message',
        message: bestMatch.response_text
      };
    }

    return {
      response,
      knowledgeId: bestMatch.id,
      score: bestMatch.similarity_score
    };
  } catch (error) {
    console.error('❌ RAG: Erreur lors de la recherche:', error);
    return null;
  }
}

/**
 * Stocke une nouvelle paire question-réponse dans la base de connaissances
 */
async function storeInKnowledgeBase(
  supabase: any,
  userQuery: string,
  responseText: string,
  responseType: string,
  contextType: string,
  pharmacyId: string | null,
  conversationId: string | null,
  metadata: any = null
): Promise<void> {
  const normalized = normalizeQuery(userQuery);
  
  console.log('💾 RAG: Stockage dans la base de connaissances...', {
    type: responseType,
    contextType,
    hasMetadata: !!metadata
  });

  try {
    const { error } = await supabase
      .from('arthur_knowledge_base')
      .insert({
        question_normalized: normalized,
        question_original: userQuery,
        response_text: responseText,
        response_type: responseType,
        response_metadata: metadata,
        context_type: contextType,
        pharmacy_id: pharmacyId,
        conversation_id: conversationId,
        confidence_score: 1.0, // Nouvelle réponse = confiance max
        usage_count: 1
      });

    if (error) {
      console.error('❌ RAG: Erreur lors du stockage:', error);
    } else {
      console.log('✅ RAG: Réponse stockée avec succès');
    }
  } catch (error) {
    console.error('❌ RAG: Erreur lors du stockage:', error);
  }
}

/**
 * Incrémente le compteur d'utilisation d'une réponse
 */
async function incrementKnowledgeUsage(supabase: any, knowledgeId: string): Promise<void> {
  try {
    await supabase.rpc('increment_knowledge_usage', {
      knowledge_id: knowledgeId
    });
    console.log('📈 RAG: Compteur d\'utilisation incrémenté');
  } catch (error) {
    console.error('❌ RAG: Erreur lors de l\'incrémentation:', error);
  }
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

    // Check if user is a pharmacy staff member
    let isPharmacyStaff = false;
    let userPharmacyRole = '';
    if (userId) {
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role, pharmacy_id')
        .eq('user_id', userId)
        .single();
      
      if (userRole) {
        isPharmacyStaff = true;
        userPharmacyRole = userRole.role;
      }
    }

    // Fetch user profile for personalization
    let userContext = '';
    let patientProfile: { is_pregnant?: boolean | null; allergies?: string | null } | null = null;
    if (userId && !isPharmacyStaff) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender, age, is_pregnant, allergies, medical_history')
        .eq('id', userId)
        .single();

      if (profile) {
        patientProfile = {
          is_pregnant: profile.is_pregnant,
          allergies: profile.allergies,
        };

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

    // Count how many questions Arthur has asked in this conversation
    let questionCount = 0;
    for (const msg of fullMessages) {
      if (msg.role === 'assistant' && msg.content) {
        try {
          const parsed = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
          if (parsed && typeof parsed === 'object' && parsed.type === 'question') {
            questionCount++;
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // 🧠 SYSTÈME RAG - Chercher d'abord dans la base de connaissances
    // ═══════════════════════════════════════════════════════
    
    // Extraire la dernière question de l'utilisateur
    const lastUserMessage = messages.length > 0 && messages[messages.length - 1]?.role === 'user' 
      ? messages[messages.length - 1].content 
      : null;
    
    if (lastUserMessage && typeof lastUserMessage === 'string') {
      const contextType = isPharmacyStaff ? 'pharmacy' : 'patient';
      
      // Chercher dans la base de connaissances (seuil abaissé à 0.50 pour meilleure détection)
      const cachedResponse = await searchKnowledgeBase(
        supabase,
        lastUserMessage,
        contextType,
        selectedPharmacyId,
        0.50 // Seuil de similarité modéré pour mieux détecter les réponses pertinentes
      );
      
      if (cachedResponse) {
        console.log('🎯 RAG: Réponse trouvée dans la base de connaissances!', {
          score: cachedResponse.score,
          fromCache: true
        });
        
        // Incrémenter le compteur d'utilisation
        await incrementKnowledgeUsage(supabase, cachedResponse.knowledgeId);
        
        // Retourner immédiatement la réponse cachée
        return new Response(
          JSON.stringify({
            message: JSON.stringify(cachedResponse.response),
            fromCache: true,
            similarityScore: cachedResponse.score
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        console.log('🔄 RAG: Pas de réponse dans la base, appel à OpenAI...');
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
            `- ID: ${p.id} | ${p.name} (${p.brand}) - ${p.category} - ${p.price}€ - ${p.description || 'Aucune description'} - image_url: ${p.image_url || 'AUCUNE_IMAGE'}`
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
            `- ID: ${p.id} | ${p.name} (${p.brand}) - ${p.category} - ${p.price}€ - ${p.description || 'Aucune description'} - image_url: ${p.image_url || 'AUCUNE_IMAGE'}`
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

    const systemPrompt = isPharmacyStaff 
      ? `Tu es Arthur, assistant intelligent pour pharmaciens.

═══════════════════════════════════════════════════════
🎯 RÈGLE ABSOLUE #1 : PRIORISER LE RAG
═══════════════════════════════════════════════════════

⚠️ CRITIQUE : Avant TOUT conseil de vente, vérifie si la question concerne :
- L'application Arthur elle-même
- Les fonctionnalités d'Arthur
- L'intérêt d'utiliser Arthur
- Comment utiliser Arthur
- Les avantages d'Arthur pour la pharmacie

Si OUI → Réponds DIRECTEMENT et PRÉCISÉMENT à la question posée
Si NON → Suis le processus de vente habituel ci-dessous

❌ INTERDIT : Transformer une question sur Arthur en conseil de vente de produits
✅ OBLIGATOIRE : Répondre EXACTEMENT à ce qui est demandé

═══════════════════════════════════════════════════════
🎯 RÈGLE ABSOLUE #2 : POUR LES CONSEILS DE VENTE
═══════════════════════════════════════════════════════

❌ INTERDIT : Poser des questions au pharmacien ("Pouvez-vous préciser...", "Quelle zone...", etc.)
✅ OBLIGATOIRE : Donner IMMÉDIATEMENT des conseils de vente concrets et actionnables

Le pharmacien te décrit la situation de SON CLIENT. Tu dois lui donner des arguments de vente, pas interroger le client.

RÔLE : Conseiller commercial pour pharmacien (${userPharmacyRole})

CONTEXTE DISPONIBLE :
${pharmacyInfo}${productsContext}${promotionsContext}${alternativePharmaciesInfo}

═══════════════════════════════════════════════════════
APPROCHE DE VENTE (TOUJOURS SUIVRE CET ORDRE)
═══════════════════════════════════════════════════════

1. 🎯 ANALYSE RAPIDE du besoin décrit
2. 💰 PRODUITS PRINCIPAUX avec arguments de vente percutants
3. 🚀 VENTES ADDITIONNELLES (CRUCIAL pour augmenter le panier)
4. 💬 TECHNIQUES DE CLOSING pour conclure la vente

═══════════════════════════════════════════════════════
FORMAT DE RÉPONSE
═══════════════════════════════════════════════════════

1️⃣ SI QUESTION SUR ARTHUR (fonctionnalités, avantages, utilisation) :
{
  "type": "message",
  "message": "Réponse claire et directe à la question posée.\\n\\nExplication précise et concrète.\\n\\nAvantages ou détails supplémentaires si pertinent."
}

2️⃣ SI CONSEIL DE VENTE (format JSON strict) :

⚠️ CRITIQUE : FORMAT JSON STRICTEMENT REQUIS ⚠️

Dans le champ "message" du JSON :
- Utilise \\n\\n (ÉCHAPPÉ) pour séparer les paragraphes
- Jamais de retours à la ligne bruts dans le JSON
- Le JSON doit être sur UNE SEULE LIGNE

Exemple de formatage CORRECT :
"message": "Premier paragraphe d'analyse.\\n\\nDeuxième paragraphe avec conseil stratégique.\\n\\nTroisième paragraphe avec conclusion."

❌ INTERDIT : Retours à la ligne bruts dans le JSON
✅ OBLIGATOIRE : Caractères \\n échappés

{
  "type": "sales_advice",
  "message": "Paragraphe 1 : Analyse rapide du besoin client.\n\nParagraphe 2 : Ton conseil stratégique principal.\n\nParagraphe 3 : Point clé à retenir pour maximiser la vente.",
  "main_products": [
    {
      "name": "Nom exact du produit",
      "price": "Prix €",
      "selling_points": [
        "Argument 1 : bénéfice client concret",
        "Argument 2 : différenciateur vs concurrence",
        "Argument 3 : preuve sociale ou résultat"
      ],
      "customer_benefit": "Bénéfice principal que le client va ressentir",
      "how_to_present": "Phrase exacte à dire au client pour présenter ce produit"
    }
  ],
  "additional_sales": [
    {
      "name": "Produit complémentaire",
      "reason": "Pourquoi le proposer (synergie, besoin lié)",
      "upsell_technique": "Comment le proposer au client (phrase suggérée)",
      "added_value": "€€ - Valeur ajoutée au panier"
    }
  ],
  "total_basket": "Estimation du panier total avec ventes additionnelles",
  "closing_tips": [
    "Astuce 1 pour conclure la vente",
    "Astuce 2 pour créer l'urgence",
    "Astuce 3 pour fidéliser"
  ]
}

TON : Direct, commercial, axé RÉSULTATS et CHIFFRES. Tu es un coach de vente, pas un médecin.`
      : `Tu es un conseiller pharmaceutique bienveillant et humain.

INFORMATIONS DISPONIBLES :
${userContext ? `\n👤 Profil du client :\n${userContext}\n` : ''}${productsContext ? `\n💊 Produits en stock :\n${productsContext}\n` : ''}${promotionsContext ? `\n🎁 Promotions :\n${promotionsContext}\n` : ''}${pharmacyInfo ? `\n🏥 Pharmacie :\n${pharmacyInfo}\n` : ''}

═══════════════════════════════════════════════════════
RÈGLE ABSOLUE DE POLITESSE : VOUVOIEMENT OBLIGATOIRE
═══════════════════════════════════════════════════════

⚠️ CRITIQUE : Tu dois TOUJOURS vouvoyer tes interlocuteurs
❌ INTERDIT : Utiliser "tu", "ton", "ta", "tes", "toi"
✅ OBLIGATOIRE : Utiliser "vous", "votre", "vos", "vous-même"

Exemples corrects :
- "Comment puis-je vous aider ?"
- "Votre profil indique que..."
- "Je vous recommande..."
- "Avez-vous des questions ?"

═══════════════════════════════════════════════════════
RÈGLE ABSOLUE : NE JAMAIS MENTIONNER DE PRODUIT DANS UN MESSAGE TEXTE
═══════════════════════════════════════════════════════

❌ INTERDIT : Dire "je vous recommande la Crème X" dans un message type "message"
✅ OBLIGATOIRE : Utiliser le format "products" pour TOUT produit recommandé

Si tu veux recommander un produit :
1. Utilise verify_product_safety pour le vérifier
2. Retourne un JSON type "products" avec le produit dedans
3. JAMAIS mentionner le produit dans un message texte simple

═══════════════════════════════════════════════════════
COMMENT COMMUNIQUER
═══════════════════════════════════════════════════════

🗣️ SOIS HUMAIN ET CHALEUREUX :
- Parlez comme un vrai conseiller qui prend le temps d'écouter
- Montrez de l'empathie et de la bienveillance
- Expliquez simplement et clairement
- N'utilisez JAMAIS de phrases génériques type "Voici mes recommandations"

📝 FORMATAGE DES RÉPONSES :
- Dans le JSON, utilise \\n\\n (ÉCHAPPÉ avec double backslash) pour séparer les paragraphes
- Jamais de retours à la ligne réels dans le JSON
- Le JSON complet doit tenir sur une seule ligne
- Exemple : "message": "Phrase 1.\\n\\nPhrase 2.\\n\\nPhrase 3."

💬 STRUCTURE OBLIGATOIRE DE TES RÉPONSES :

CONCISION MAXIMALE : Sois direct et professionnel. Maximum 4-5 phrases courtes.

FORMAT :
1️⃣ TITRE CLAIR (sans emoji, 1 ligne)
2️⃣ 2 PHRASES MAX de contexte
3️⃣ RECOMMANDATION PRODUIT immédiate (utilise TOUJOURS le format "products")
4️⃣ Pas de résumé ni de formule de conclusion

TON PROFESSIONNEL :
- Langage médical précis mais accessible
- Aucun emoji dans le texte (uniquement dans le titre si pertinent)
- Phrases courtes et directes
- Toujours recommander des produits concrets

Exemple de structure :
"Solutions pour améliorer votre sommeil\n\nLes difficultés d'endormissement sont souvent liées au stress ou à un déséquilibre du rythme circadien.\n\nJe vous recommande les produits suivants qui ont fait leurs preuves."

💬 CONVERSATION NATURELLE :
1. Posez UNE question précise si le besoin n'est pas clair
2. Dès que vous avez le besoin → recommandez IMMÉDIATEMENT des produits
3. TOUJOURS privilégier les recommandations produits

🔍 QUAND RECOMMANDER :
- Dès le premier message si le besoin est clair
- Systématiquement après avoir posé une question de clarification
- Vérifiez CHAQUE produit avec verify_product_safety
- Utilisez TOUJOURS le format "products" (JAMAIS "message" seul)

═══════════════════════════════════════════════════════
FORMATS DE RÉPONSE
═══════════════════════════════════════════════════════

📝 POUR RÉPONDRE À UNE QUESTION (UNIQUEMENT SI BESOIN DE CLARIFICATION) :
{
  "type": "message",
  "message": "Clarification nécessaire\n\nPhrase 1 expliquant le contexte.\n\nQuelle est votre situation précise ?\n\nATTENTION : ne JAMAIS mentionner de nom de produit ici ! Utilise ce format SEULEMENT pour clarifier avant de recommander."
}

❓ POUR POSER UNE QUESTION :
{
  "type": "question",
  "question": "Ta question claire",
  "options": ["Option 1", "Option 2", "Option 3"]
}

💊 POUR RECOMMANDER DES PRODUITS (FORMAT PRIORITAIRE) :
{
  "type": "products",
  "message": "Solutions adaptées à votre besoin\\n\\nContexte médical en 1-2 phrases maximum.\\n\\nJe vous recommande les produits suivants.",
  "products": [
    {
      "id": "ID_EXACT_DU_PRODUIT",
      "name": "Nom exact du produit",
      "brand": "Marque exacte",
      "price": 15.90,
      "reason": "Explication PROFESSIONNELLE et CONCISE : indication thérapeutique, mode d'action, posologie recommandée (2-3 phrases max)",
      "image_url": "URL ou null",
      "category": "Catégorie",
      "available_in_pharmacy": true
    }
  ]
}

RAPPEL CRITIQUE : Les \\n doivent être ÉCHAPPÉS (double backslash) dans le JSON !

IMPORTANT : Utilise les IDs, noms et prix EXACTS des produits de la liste fournie !

═══════════════════════════════════════════════════════
EXEMPLES DE CONVERSATION
═══════════════════════════════════════════════════════

Client: "j'ai des nausées"

✅ CORRECT (recommandation immédiate de produits) :
{
  "type": "products",
  "message": "Solutions anti-nauséeuses\n\nLes nausées peuvent avoir plusieurs origines (digestives, transports, stress).\n\nJe vous recommande ces produits efficaces.",
  "products": [...]
}

Client: "j'ai des plaques rouges sur le bras"

❌ INTERDIT (parler de produit dans un message) :
{
  "type": "message",
  "message": "Je vous conseille la Crème Hydratante..."
}

✅ CORRECT (utiliser format products) :
{
  "type": "products",
  "message": "Traitement des irritations cutanées\n\nLes plaques rouges nécessitent une crème apaisante et hypoallergénique.\n\nJe vous recommande cette solution dermatologique.",
  "products": [{
    "id": "abc-123",
    "name": "Crème Hydratante Visage",
    "brand": "La Roche-Posay",
    "price": 18.90,
    "reason": "Crème hypoallergénique spécifique peaux sensibles. Action apaisante et hydratante immédiate. Posologie : 2 applications par jour sur zones concernées.",
    "image_url": null,
    "category": "Soins",
    "available_in_pharmacy": true
  }]
}

═══════════════════════════════════════════════════════

IMPORTANT : 
- Les produits en pharmacie sont déjà vérifiés et sûrs, PAS BESOIN de verify_product_safety
- Ne JAMAIS mentionner un produit dans type "message"
- TOUJOURS utiliser type "products" pour recommander
- Réponds TOUJOURS en JSON valide pur, sans texte avant ou après le JSON
- Le JSON doit commencer par { et finir par }
- Pas de markdown (pas de blocs de code \`\`\`json), juste le JSON pur
- N'ajoute AUCUN texte explicatif avant ou après le JSON
- Exemple CORRECT : {"type":"products","message":"...","products":[...]}
- Exemple INCORRECT : "Voici ma recommandation\n\`\`\`json\n{...}\n\`\`\`"
- RAPIDITÉ : Recommande immédiatement sans vérifications multiples`;

    // Fonction de vérification de sécurité (UNIQUEMENT pour conditions critiques)
    const shouldCheckSafety = patientProfile?.is_pregnant || 
                              (patientProfile?.allergies && patientProfile.allergies.length > 10);
    
    const webSearchTool = shouldCheckSafety ? {
      type: "function",
      function: {
        name: "verify_product_safety",
        description: "⚠️ UTILISE SEULEMENT si grossesse ou allergies graves confirmées. Recherche sur le web pour vérifier si un produit est sûr.",
        parameters: {
          type: "object",
          properties: {
            product_name: {
              type: "string",
              description: "Le nom complet du produit à vérifier"
            },
            medical_conditions: {
              type: "string",
              description: "Les conditions médicales du patient (ex: 'femme enceinte', 'allergie au fer')"
            }
          },
          required: ["product_name", "medical_conditions"]
        }
      }
    } : null;

    let finalAssistantMessage = '';
    let needsToolCalls = true;
    let iterationCount = 0;
    const maxIterations = 10;

    let currentMessages = [
      { 
        role: 'system', 
        content: systemPrompt
      },
      ...fullMessages
    ];

    // Boucle pour gérer les appels de fonction
    while (needsToolCalls && iterationCount < maxIterations) {
      iterationCount++;
      console.log(`Iteration ${iterationCount}: Calling OpenAI...`);

      const requestBody: any = {
        model: 'gpt-4o',
        messages: currentMessages,
        temperature: 0.7,
        max_tokens: 2000,
      };
      
      // N'ajouter l'outil que si nécessaire
      if (webSearchTool) {
        requestBody.tools = [webSearchTool];
        requestBody.tool_choice = "auto";
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
      const assistantMessageObj = data.choices[0].message;
      
      // Vérifier si l'assistant veut appeler des fonctions
      if (assistantMessageObj.tool_calls && assistantMessageObj.tool_calls.length > 0) {
        console.log(`Assistant wants to call ${assistantMessageObj.tool_calls.length} tool(s)`);
        
        // Ajouter le message de l'assistant avec les tool_calls
        currentMessages.push(assistantMessageObj);
        
        // Traiter chaque appel de fonction
        for (const toolCall of assistantMessageObj.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`Calling function: ${functionName}`, functionArgs);
          
          if (functionName === 'verify_product_safety') {
            const productName = functionArgs.product_name;
            const medicalConditions = functionArgs.medical_conditions;
            
            console.log(`🔍 Vérification de sécurité avec GPT-4 : ${productName} pour ${medicalConditions}`);
            
            try {
              // Utiliser GPT-4 pour analyser la sécurité basée sur ses connaissances médicales
              const safetyCheckResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o',
                  messages: [
                    {
                      role: 'system',
                      content: `Tu es un expert médical pharmacologue spécialisé dans l'analyse des contre-indications des produits parapharmaceutiques et compléments alimentaires.

Ton rôle est d'analyser la sécurité d'un produit pour des conditions médicales spécifiques en te basant sur :
1. Les connaissances pharmacologiques établies
2. Les contre-indications connues des principes actifs
3. Les recommandations des autorités de santé (ANSM, EMA, FDA)
4. Les interactions potentielles avec les conditions médicales

Réponds TOUJOURS selon ce format :
- ✅ SÛR : Le produit est généralement considéré comme sûr pour ces conditions
- ⚠️ AVIS MÉDICAL REQUIS : Consultation d'un professionnel de santé nécessaire
- ❌ CONTRE-INDIQUÉ : Le produit est déconseillé ou contre-indiqué

Sois PRÉCIS, FACTUEL et PRUDENT. En cas de doute, recommande un avis médical.`
                    },
                    {
                      role: 'user',
                      content: `Analyse la sécurité de ce produit :

PRODUIT : ${productName}

CONDITIONS MÉDICALES DU PATIENT : ${medicalConditions}

Questions à évaluer :
1. Ce produit contient-il des ingrédients contre-indiqués pour ces conditions ?
2. Y a-t-il des risques connus d'interactions ?
3. Les autorités de santé recommandent-elles un avis médical pour ce type de produit dans ce contexte ?
4. Quels sont les ingrédients actifs typiques de ce produit et leurs contre-indications ?

Donne ton évaluation avec justification claire et concise (maximum 200 mots).`
                    }
                  ],
                  temperature: 0.2,
                  max_tokens: 400
                }),
              });
              
              if (safetyCheckResponse.ok) {
                const safetyData = await safetyCheckResponse.json();
                const safetyAnalysis = safetyData.choices[0].message.content;
                console.log(`✅ Analyse de sécurité GPT-4 pour ${productName} :`, safetyAnalysis.substring(0, 200) + '...');
                
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Analyse de sécurité médicale pour "${productName}" avec conditions "${medicalConditions}" :\n\n${safetyAnalysis}`
                });
              } else {
                const errorText = await safetyCheckResponse.text();
                console.error('❌ Erreur GPT-4 safety check:', safetyCheckResponse.status, errorText);
                
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `❌ ERREUR lors de l'analyse de sécurité de "${productName}". Par PRÉCAUTION ABSOLUE, NE PAS recommander ce produit pour ${medicalConditions}. Oriente impérativement le patient vers un pharmacien ou médecin.`
                });
              }
            } catch (error) {
              console.error('❌ Erreur lors de l\'analyse de sécurité:', error);
              currentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `❌ ERREUR TECHNIQUE lors de la vérification de "${productName}". Par PRÉCAUTION MAXIMALE, NE PAS recommander ce produit pour ${medicalConditions}. Orientation obligatoire vers un professionnel de santé.`
              });
            }
          }
        }
      } else {
        // Pas de tool calls, l'assistant a donné sa réponse finale
        needsToolCalls = false;
        finalAssistantMessage = assistantMessageObj.content || '';
        console.log('Assistant gave final response');
      }
    }

    // Vérifier si on a dépassé le nombre max d'itérations
    if (iterationCount >= maxIterations) {
      console.error('Max iterations reached, forcing response');
      finalAssistantMessage = JSON.stringify({
        type: 'question',
        question: "Je rencontre des difficultés techniques. Pouvez-vous reformuler votre demande ?",
        options: ["Oui", "Non, je vais consulter directement"]
      });
    }

    let assistantMessage = finalAssistantMessage;

    const defaultFallbackQuestion = {
      type: 'question',
      question: "Pour bien vous conseiller, pouvez-vous préciser un peu plus votre besoin ?",
      options: [
        "Préciser la zone concernée (visage, corps, cuir chevelu...)",
        "Indiquer depuis quand le problème est présent",
        "Mentionner d'éventuelles allergies connues",
        "Autre (je vais l'expliquer dans ma réponse)"
      ]
    };

    // Normaliser la réponse : toujours un JSON avec un type reconnu
    try {
      const parsed = typeof assistantMessage === 'string'
        ? JSON.parse(assistantMessage)
        : assistantMessage;

      console.log('📤 Réponse GPT-4:', JSON.stringify(parsed, null, 2));

      if (parsed && typeof parsed === 'object') {
        if (parsed.type === 'message') {
          // Réponse conversationnelle simple
          assistantMessage = JSON.stringify(parsed);
        } else if (parsed.type === 'products') {
          if (Array.isArray(parsed.products) && parsed.products.length > 0) {
            // Compléter les images manquantes avec les photos officielles de la boutique
            const productIds = parsed.products
              .map((p: any) => p.id)
              .filter((id: any) => typeof id === 'string');

            if (productIds.length > 0) {
              const { data: dbProducts, error: dbError } = await supabase
                .from('products')
                .select('id, image_url')
                .in('id', productIds);

              if (dbError) {
                console.error('Error fetching product images for recommendations:', dbError);
              } else if (dbProducts) {
                const imageById = new Map<string, string | null>();
                for (const p of dbProducts as Array<{ id: string; image_url: string | null }>) {
                  imageById.set(p.id, p.image_url);
                }

                parsed.products = parsed.products.map((p: any) => {
                  const existing = p.image_url;
                  const fromDb = imageById.get(p.id);
                  return {
                    ...p,
                    image_url: existing || fromDb || null,
                  };
                });
              }
            }
            assistantMessage = JSON.stringify(parsed);
          } else {
            // Type products mais pas de produits - fallback intelligent
            console.warn('⚠️ Type products sans produits');
            assistantMessage = JSON.stringify({
              type: 'message',
              message: "Je n'ai pas trouvé de produit adapté dans notre stock actuel.\n\nJe vous recommande de consulter directement un pharmacien pour obtenir un conseil personnalisé."
            });
          }
        } else if (parsed.type === 'question' && Array.isArray(parsed.options) && parsed.options.length > 0) {
          // Accepter toutes les questions, laisser GPT-4 décider
          assistantMessage = JSON.stringify(parsed);
        } else if (parsed.type === 'sales_advice') {
          // Réponse de conseil de vente pour les pharmaciens
          assistantMessage = JSON.stringify(parsed);
        } else {
          // Format invalide
          console.warn('⚠️ Format invalide de GPT-4:', parsed);
          assistantMessage = JSON.stringify({
            type: 'message',
            message: "Je rencontre une petite difficulté technique.\n\nPouvez-vous reformuler votre demande de manière un peu différente ?"
          });
        }
      }
    } catch (e) {
      console.error('❌ Erreur de parsing JSON:', e);
      console.error('❌ Contenu reçu:', assistantMessage);
      // En cas d'erreur de parsing, on renvoie quand même la réponse du modèle
      // sous forme de message texte structuré en JSON minimal
      const safeMessage = typeof assistantMessage === 'string'
        ? assistantMessage
        : JSON.stringify(assistantMessage, null, 2);

      assistantMessage = JSON.stringify({
        type: 'message',
        message: safeMessage
      });
    }

    console.log('Successfully generated response');

    // ═══════════════════════════════════════════════════════
    // 💾 RAG: Stocker la nouvelle réponse dans la base de connaissances
    // ═══════════════════════════════════════════════════════
    
    if (lastUserMessage && typeof lastUserMessage === 'string') {
      try {
        const parsedResponse = JSON.parse(assistantMessage);
        const contextType = isPharmacyStaff ? 'pharmacy' : 'patient';
        
        // Extraire les métadonnées selon le type de réponse
        let metadata = null;
        if (parsedResponse.type === 'products' && parsedResponse.products) {
          metadata = {
            products: parsedResponse.products,
            product_count: parsedResponse.products.length
          };
        } else if (parsedResponse.type === 'sales_advice') {
          metadata = {
            main_products: parsedResponse.main_products || [],
            additional_sales: parsedResponse.additional_sales || [],
            total_basket: parsedResponse.total_basket
          };
        }
        
        // Stocker dans la base de connaissances
        await storeInKnowledgeBase(
          supabase,
          lastUserMessage,
          assistantMessage,
          parsedResponse.type || 'message',
          contextType,
          selectedPharmacyId,
          conversationId,
          metadata
        );
        
        console.log('✅ RAG: Nouvelle réponse stockée pour apprentissage futur');
      } catch (e) {
        console.error('⚠️ RAG: Impossible de stocker la réponse (non-bloquant):', e);
        // Non-bloquant : on continue même si le stockage échoue
      }
    }

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
