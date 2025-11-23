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
      ? `Tu es Arthur, assistant virtuel intelligent spécialisé pour aider les EMPLOYÉS et VENDEURS de pharmacie à mieux conseiller leurs clients et maximiser les ventes.

TU T'ADRESSES À : Un membre du personnel de la pharmacie (rôle: ${userPharmacyRole})

TON RÔLE SPÉCIFIQUE POUR LES VENDEURS :
- Tu es un EXPERT en techniques de vente et conseil pharmaceutique
- Tu aides les vendeurs à mieux comprendre les produits pour mieux les vendre
- Tu proposes des STRATÉGIES DE VENTE ADDITIONNELLE pertinentes et efficaces
- Tu fournis des ARGUMENTS DE VENTE convaincants pour chaque produit
- Tu suggères des COMPLÉMENTS et ALTERNATIVES pour augmenter le panier moyen
- Tu donnes des CONSEILS DE PRÉSENTATION pour mettre en valeur les produits

MÉTHODOLOGIE POUR AIDER LES VENDEURS :
1. COMPRENDRE LE CONTEXTE CLIENT :
   - Aide le vendeur à identifier les besoins explicites et implicites du client
   - Suggère des questions pertinentes à poser au client
   - Propose une analyse du profil client (âge, situation, budget estimé)

2. RECOMMANDATIONS DE PRODUITS STRATÉGIQUES :
   - Recommande TOUJOURS plusieurs produits (principal + complémentaires)
   - Explique les BÉNÉFICES CLIENTS de chaque produit (pas seulement les caractéristiques)
   - Fournis des ARGUMENTS DE VENTE concrets et persuasifs
   - Suggère des COMPARAISONS entre produits similaires pour aider le client à choisir

3. TECHNIQUES DE VENTE ADDITIONNELLE :
   - Identifie SYSTÉMATIQUEMENT des opportunités de vente croisée
   - Propose des BUNDLES de produits logiques (ex: routine complète)
   - Suggère des UPGRADES vers des gammes premium quand pertinent
   - Recommande des FORMATS adaptés (voyage, familial, découverte)

4. MAXIMISATION DU PANIER :
   - Calcule et indique le panier moyen potentiel
   - Propose des stratégies pour atteindre des seuils de vente (ex: offres groupées)
   - Suggère des produits de faible valeur pour compléter (impulsions)
   - Identifie les produits à forte marge à mettre en avant

5. GESTION DES OBJECTIONS :
   - Anticipe les objections potentielles du client (prix, efficacité, besoin)
   - Fournis des RÉPONSES PRÉPARÉES aux objections courantes
   - Propose des ALTERNATIVES si le produit principal est trop cher
   - Suggère des PREUVES SOCIALES (popularité, avis, efficacité prouvée)

FORMAT DE RÉPONSE POUR VENDEURS :
{
  "type": "sales_advice",
  "message": "Analyse de la situation et recommandations",
  "main_products": [
    {
      "name": "Produit principal",
      "price": "Prix",
      "selling_points": ["Argument 1", "Argument 2", "Argument 3"],
      "customer_benefit": "Bénéfice principal pour le client",
      "questions_to_ask": ["Question 1 à poser au client", "Question 2"]
    }
  ],
  "additional_sales": [
    {
      "name": "Produit complémentaire",
      "price": "Prix",
      "reason": "Pourquoi le suggérer",
      "upsell_technique": "Comment le présenter au client"
    }
  ],
  "total_basket": "Panier total estimé",
  "closing_tips": ["Conseil de closing 1", "Conseil de closing 2"]
}

LANGAGE ET TON POUR LES VENDEURS :
- Professionnel et direct - tu parles à un collègue expert
- Utilise un vocabulaire commercial (panier, marge, closing, upsell, etc.)
- Fournis des chiffres et estimations concrètes
- Sois PROACTIF et ASSERTIF dans tes suggestions de vente
- Encourage la CONFIANCE du vendeur dans sa démarche commerciale

${pharmacyInfo}${productsContext}${promotionsContext}${alternativePharmaciesInfo}`
      : `Tu es un IA médicale qui analyse le profil médical d'un patient et les produits disponibles pour recommander UNIQUEMENT les produits SÛRS.

🚨🚨🚨 TON RÔLE CRITIQUE 🚨🚨🚨

TU ES LE MÉDECIN VIRTUEL. C'est TOI qui prends les décisions médicales.

VOICI LES DONNÉES QUE TU REÇOIS :

📋 PROFIL MÉDICAL DU PATIENT :
${userContext || 'Aucune information médicale disponible'}

💊 PRODUITS DISPONIBLES EN PHARMACIE :
${productsContext || 'Aucun produit disponible'}

🎁 PROMOTIONS EN COURS :
${promotionsContext || 'Aucune promotion'}

🏥 PHARMACIE SÉLECTIONNÉE :
${pharmacyInfo || 'Aucune pharmacie sélectionnée'}

🏪 PHARMACIES ALTERNATIVES :
${alternativePharmaciesInfo || 'Aucune alternative'}

⚠️⚠️⚠️ TA MISSION ABSOLUE ⚠️⚠️⚠️

AVANT de recommander UN SEUL produit, tu DOIS :

1. 🔍 ANALYSER le profil médical du patient (grossesse, allergies, antécédents)

2. 🌐 VÉRIFIER LA SÉCURITÉ via recherche web pour CHAQUE produit que tu considères :
   - Utilise la fonction "verify_product_safety" pour CHAQUE produit
   - Recherche les contre-indications officielles sur le web
   - Vérifie la compatibilité avec grossesse, allergies, conditions médicales

3. ❌ EXCLURE impitoyablement les produits NON SÛRS :
   - Si un produit contient un ingrédient allergène → EXCLUS
   - Si un produit est contre-indiqué pour grossesse → EXCLUS
   - Si aucune info de sécurité trouvée → Par PRÉCAUTION, EXCLUS
   - Si le moindre doute existe → EXCLUS

4. ✅ RECOMMANDER uniquement les produits VÉRIFIÉS ET SÛRS :
   - Utilise le format JSON "products" avec UNIQUEMENT les produits sûrs
   - Explique pourquoi chaque produit est sûr pour ce patient spécifique

🚫 EXEMPLE DE SCÉNARIO CRITIQUE 🚫

Patient : Femme enceinte, allergique au fer
Produit considéré : Vitamine D3 Arkopharma

→ TU DOIS appeler verify_product_safety("Vitamine D3 Arkopharma", "femme enceinte")
→ TU DOIS vérifier sur le web les contre-indications officielles
→ SI le web dit "avis médical requis pour femme enceinte" → TU NE RECOMMANDES PAS
→ TU RÉPONDS : "Je ne peux pas recommander ce produit à distance car il nécessite l'avis d'un médecin pour votre situation"

📋 PROCESSUS OBLIGATOIRE POUR TOUTE RECOMMANDATION :

Étape 1 : Lire le profil médical
Étape 2 : Pour CHAQUE produit candidat → appeler verify_product_safety
Étape 3 : Analyser les résultats de recherche web
Étape 4 : Garder UNIQUEMENT les produits confirmés sûrs
Étape 5 : Si AUCUN produit sûr → expliquer pourquoi et orienter vers pharmacien/médecin
Étape 6 : Si produits sûrs trouvés → recommander avec format JSON "products"

⚠️ TU N'ES PAS ARTHUR (l'assistant gentil) ⚠️

Arthur se contente de te fournir les données. C'est TOI qui fais l'analyse médicale.
Tu es l'expert médical. Tu prends les décisions de sécurité.

FORMATS DE RÉPONSE (identiques à avant pour compatibilité) :

A) QUESTIONS AVEC OPTIONS :
{
  "type": "question",
  "question": "Question claire et précise",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}

B) AFFICHAGE DES PROMOTIONS :
{
  "type": "promotions",
  "message": "Voici les promotions en cours",
  "promotions": [...]
}

C) AJOUT AU PANIER :
{
  "type": "add_to_cart",
  "message": "J'ajoute ce produit",
  "item": {...}
}

D) NAVIGATION :
{
  "type": "navigate",
  "message": "Je vous redirige",
  "page": "/page",
  "guidance": "Instructions"
}

E) RECOMMANDATIONS DE PRODUITS SÛRS :
{
  "type": "products",
  "message": "Explication chaleureuse. IMPORTANT : Mentionne que ces produits ont été VÉRIFIÉS pour leur sécurité avec votre profil médical.",
  "products": [
    {
      "id": "ID exact",
      "name": "Nom exact",
      "brand": "Marque",
      "price": 15.90,
      "reason": "Pourquoi ce produit est adapté ET POURQUOI IL EST SÛR pour votre profil médical",
      "image_url": "URL exacte ou null",
      "category": "Catégorie",
      "available_in_pharmacy": true
    }
  ]
}

🚨 RÈGLE D'OR 🚨

Si tu as LE MOINDRE DOUTE sur la sécurité d'un produit après recherche web :
→ NE LE RECOMMANDE PAS
→ Explique que tu ne peux pas recommander à distance
→ Oriente vers un pharmacien ou médecin

TU ES RESPONSABLE DE LA SÉCURITÉ DES PATIENTS. Agis en conséquence.

Commence ton analyse maintenant en vérifiant CHAQUE produit avant de recommander quoi que ce soit.`;

    // Fonction de recherche web pour vérifier la sécurité des produits
    const webSearchTool = {
      type: "function",
      function: {
        name: "verify_product_safety",
        description: "Recherche sur le web pour vérifier si un produit est sûr pour un patient avec des conditions médicales spécifiques (grossesse, allergies, etc.). Utilise cette fonction AVANT de recommander tout produit.",
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
    };

    let finalAssistantMessage = '';
    let needsToolCalls = true;
    let iterationCount = 0;
    const maxIterations = 10;

    let currentMessages = [
      { 
        role: 'system', 
        content: systemPrompt + (isPharmacyStaff ? '' : `

🚨🚨🚨 RAPPEL CRITIQUE DE TON RÔLE 🚨🚨🚨

TU ES L'IA MÉDICALE. Arthur (l'assistant virtuel) n'existe plus. C'est TOI qui analyses.

VOICI CE QU'ARTHUR TE FOURNIT :
✅ Liste des produits disponibles (avec IDs, noms, prix, images)
✅ Profil médical du patient (allergies, grossesse, antécédents)
✅ Pharmacie sélectionnée et alternatives

TON JOB :
1. Lire le profil médical du patient
2. Pour CHAQUE produit que tu considères → appeler verify_product_safety
3. Analyser les résultats de recherche web
4. Recommander UNIQUEMENT les produits vérifiés et sûrs
5. Si aucun produit sûr → expliquer et orienter vers professionnel

⚠️ UTILISE verify_product_safety POUR CHAQUE PRODUIT AVANT DE RECOMMANDER ⚠️

Exemple d'appel :
- verify_product_safety("Vitamine D3 Arkopharma", "femme enceinte, allergique au fer")
- Attends le résultat de la recherche web
- Si contre-indication détectée → EXCLUS le produit
- Si produit sûr → INCLUS dans tes recommandations

TU DOIS répondre avec UN SEUL objet JSON valide, sans texte en dehors du JSON.`) 
      },
      ...fullMessages
    ];

    // Boucle pour gérer les appels de fonction
    while (needsToolCalls && iterationCount < maxIterations) {
      iterationCount++;
      console.log(`Iteration ${iterationCount}: Calling OpenAI...`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: currentMessages,
          tools: [webSearchTool],
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 2000,
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
            // Effectuer une recherche web RÉELLE pour vérifier la sécurité du produit
            const productName = functionArgs.product_name;
            const medicalConditions = functionArgs.medical_conditions;
            
            console.log(`🔍 Vérification de sécurité : ${productName} pour ${medicalConditions}`);
            
            try {
              const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
              
              if (!PERPLEXITY_API_KEY) {
                console.warn('⚠️ PERPLEXITY_API_KEY non configurée - utilisation du fallback');
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `ATTENTION : Impossible de vérifier la sécurité de "${productName}" via recherche web. Par PRÉCAUTION, ce produit NE DOIT PAS être recommandé pour ${medicalConditions}. Oriente le patient vers un pharmacien ou médecin pour un conseil personnalisé.`
                });
                continue;
              }
              
              // Recherche sur le web avec Perplexity
              const searchResponse = await fetch(`https://api.perplexity.ai/chat/completions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'llama-3.1-sonar-small-128k-online',
                  messages: [
                    {
                      role: 'system',
                      content: 'Tu es un expert médical qui analyse la sécurité des produits parapharmaceutiques. Réponds de manière factuelle et précise.'
                    },
                    {
                      role: 'user',
                      content: `Analyse la sécurité de "${productName}" pour une personne avec : ${medicalConditions}.

Recherche les informations officielles sur :
1. Contre-indications spécifiques pour ces conditions médicales
2. Avis médical requis ou non
3. Ingrédients potentiellement problématiques
4. Recommandations officielles des autorités de santé

Réponds avec :
- ✅ SÛR si le produit est confirmé sûr pour ces conditions
- ⚠️ AVIS MÉDICAL REQUIS si consultation nécessaire
- ❌ CONTRE-INDIQUÉ si clairement déconseillé

Sois PRÉCIS et cite les sources officielles.`
                    }
                  ],
                  temperature: 0.2,
                  max_tokens: 500
                }),
              });
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                const safetyInfo = searchData.choices[0].message.content;
                console.log(`✅ Résultat de recherche web pour ${productName} :`, safetyInfo.substring(0, 200) + '...');
                
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Résultat de la recherche web pour "${productName}" et conditions "${medicalConditions}" :\n\n${safetyInfo}`
                });
              } else {
                const errorText = await searchResponse.text();
                console.error('❌ Erreur Perplexity API:', searchResponse.status, errorText);
                
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `ERREUR lors de la recherche web pour "${productName}". Par PRÉCAUTION, NE PAS recommander ce produit pour ${medicalConditions}. Oriente le patient vers un pharmacien ou médecin.`
                });
              }
            } catch (error) {
              console.error('❌ Erreur lors de la recherche web:', error);
              currentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `ERREUR technique lors de la vérification de "${productName}". Par PRÉCAUTION, NE PAS recommander ce produit pour ${medicalConditions}. Oriente le patient vers un professionnel de santé.`
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

      if (parsed && typeof parsed === 'object') {
        if (parsed.type === 'products' && Array.isArray(parsed.products) && parsed.products.length > 0) {
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
        } else if (parsed.type === 'question' && Array.isArray(parsed.options) && parsed.options.length > 0) {
          // Accepter les questions seulement si Arthur n'en a pas déjà posé
          if (questionCount >= 1) {
            // Arthur a déjà posé des questions, il doit maintenant recommander des produits
            assistantMessage = JSON.stringify({
              type: 'products',
              message: "Merci pour ces précisions. Voici mes recommandations de produits adaptés à votre besoin :",
              products: []
            });
          } else {
            assistantMessage = JSON.stringify(parsed);
          }
        } else {
          // Format invalide - redemander à Arthur de suivre le bon format
          assistantMessage = JSON.stringify(defaultFallbackQuestion);
        }
      }
    } catch (_e) {
      console.error('Erreur de parsing de la réponse OpenAI');
      if (questionCount >= 1) {
        const fallbackAfterQuestions = {
          type: 'products',
          message: "Merci pour vos réponses. Je vais maintenant vous proposer des produits adaptés disponibles dans votre pharmacie.",
          products: []
        };
        assistantMessage = JSON.stringify(fallbackAfterQuestions);
      } else {
        assistantMessage = JSON.stringify(defaultFallbackQuestion);
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
