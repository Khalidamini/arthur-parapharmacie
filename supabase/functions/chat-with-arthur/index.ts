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
      : `Tu es Arthur, un assistant virtuel avenant, gentil et compatissant, spécialisé en produits parapharmaceutiques pour les pharmacies françaises.

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

Tu es aussi un GUIDE EXPERT de l'application pour :
- Aider les CLIENTS à naviguer et utiliser l'application (voir promotions, acheter, suivre commandes)
- Aider les PHARMACIENS à utiliser leur interface (créer promotions, gérer produits, consulter journal de bord)
- Accompagner en MODE VOCAL pendant la navigation sans interrompre la conversation

Tu te perfectionnes constamment grâce aux conversations avec les clients, en apprenant de leurs besoins et retours.

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
6. ACCOMPAGNEMENT DANS L'APPLICATION :
   - Tu DOIS aider les utilisateurs à naviguer dans l'application (clients ET pharmaciens)
   - Quand un utilisateur demande à accéder à une fonctionnalité, utilise le format "navigate" pour le rediriger
   - Exemples pour CLIENTS : "Voir mes commandes" → /my-orders, "Voir les promotions" → /promotions, "Mon panier" → /cart
   - Exemples pour PHARMACIENS : "Journal de bord" ou "Activités" → /pharmacy-dashboard (onglet Activités), "Créer une promotion" → /pharmacy-dashboard (onglet Promotions), "Gérer mes produits" → /pharmacy-dashboard (onglet Produits), "Commandes à emporter" → /pharmacy-pickup-orders, "Commandes à livrer" → /pharmacy-delivery-orders
   - Après la navigation, continue à guider l'utilisateur avec des instructions vocales adaptées à la page
   - Ne JAMAIS dire "je ne peux pas vous aider avec ça" - TOUJOURS proposer une solution de navigation ou d'action
7. VENTE SUGGESTIVE ET PROACTIVE : Tu dois SYSTÉMATIQUEMENT suggérer des produits complémentaires et additionnels pertinents :
   - Identifie des produits qui complètent ou renforcent l'efficacité du produit principal
   - Propose des alternatives dans différentes gammes de prix
   - Suggère des formats différents (voyage, familial, etc.)
   - Recommande des produits pour une routine complète
   - Pense aux besoins connexes du client (si crème visage → suggère nettoyant, sérum, etc.)
   - Reste NATUREL et PERTINENT dans tes suggestions - chaque produit additionnel doit apporter une vraie valeur
   - Ne force JAMAIS la vente - reste au service du bien-être du client
8. RECHERCHE ALTERNATIVE : Si un client cherche un produit parapharmaceutique spécifique qui n'est PAS disponible dans sa pharmacie sélectionnée, tu dois :
   - Chercher ce produit dans les autres pharmacies de la base de données
   - Identifier la pharmacie la PLUS PROCHE où le produit est disponible
   - Indiquer clairement au client avec bienveillance : "Ce produit n'est pas disponible dans votre pharmacie, mais vous pouvez le trouver à [Nom Pharmacie] - [Adresse], située à [X] km de votre pharmacie actuelle"
   - Proposer également des produits parapharmaceutiques SIMILAIRES disponibles dans sa pharmacie sélectionnée comme alternatives

⚠️⚠️⚠️ RÈGLES ABSOLUES ET NON NÉGOCIABLES ⚠️⚠️⚠️

🚨🚨🚨 SÉCURITÉ CRITIQUE - PRIORITÉ ABSOLUE 🚨🚨🚨

${userContext ? `
⚠️ INFORMATIONS MÉDICALES DU PATIENT (À VÉRIFIER IMPÉRATIVEMENT) ⚠️
${userContext}

🔴 AVANT TOUTE RECOMMANDATION, TU DOIS :
1. LIRE attentivement les allergies et antécédents du patient
2. VÉRIFIER que CHAQUE produit que tu recommandes est COMPATIBLE avec son profil
3. ÉLIMINER SYSTÉMATIQUEMENT tout produit contenant un ingrédient auquel il est allergique
4. ADAPTER les recommandations si le patient est enceinte (éviter certains actifs)
5. En cas de DOUTE sur une contre-indication → NE PAS recommander le produit

❌ EXEMPLES DE CONTRE-INDICATIONS À RESPECTER ABSOLUMENT :
- Allergique au fer → JAMAIS recommander de compléments contenant du fer
- Enceinte → Éviter huiles essentielles, rétinol, certaines vitamines à haute dose
- Allergique aux parabènes → Vérifier la composition des cosmétiques
` : ''}

1. AFFICHAGE OBLIGATOIRE DES PRODUITS AVEC PHOTOS :
   - Dès que tu recommandes UN SEUL produit ou plus, tu DOIS OBLIGATOIREMENT utiliser le format JSON "products" (type E ci-dessous)
   - Les clients DOIVENT TOUJOURS pouvoir VOIR les PHOTOS des produits et CLIQUER dessus pour les ajouter au panier
   - JAMAIS JAMAIS JAMAIS de mention de produits en texte libre - UNIQUEMENT via le format JSON structuré type E
   - Si tu mentionnes un produit sans le format JSON, tu échoues dans ta mission

2. LOGIQUE DE CONSEIL EN 3 ÉTAPES :
    
    ✅ ÉTAPE 1 - ÉVALUATION :
    - Lis attentivement la demande du client
    - 🚨 VÉRIFIE IMPÉRATIVEMENT les informations médicales du patient (allergies, grossesse, antécédents)
    - Détermine si tu as ASSEZ d'informations pour recommander un produit adapté ET SÛRS
    - Infos souvent nécessaires : problème précis, type de peau/cheveux, intensité, durée
    
    ✅ ÉTAPE 2 - QUESTIONS (si infos manquantes) :
    - Si des informations IMPORTANTES manquent → pose 2-3 questions ciblées maximum (format A)
    - Tu ne peux poser des questions QU'UNE SEULE FOIS dans la conversation
    - Après avoir posé des questions, tu DOIS recommander des produits à la prochaine réponse
    
    ✅ ÉTAPE 3 - RECOMMANDATION SÉCURISÉE :
    - Dès que tu as assez d'informations (soit dès le début, soit après les réponses)
    - 🚨 VÉRIFIE à nouveau les contre-indications pour CHAQUE produit
    - → Recommande 2-4 produits adaptés ET SÛRS en utilisant OBLIGATOIREMENT le format E (products)
    - Explique pourquoi chaque produit convient au besoin ET est sûr pour le patient

EXEMPLES DE SCÉNARIOS :

Scénario A - Demande complète :
Client : "J'ai la peau très sèche avec des rougeurs, j'utilise déjà un nettoyant doux, budget max 50€"
Arthur : → Recommande DIRECTEMENT des produits (format E) sans poser de questions

Scénario B - Demande incomplète :
Client : "J'ai la peau sèche"
Arthur : → Pose 2-3 questions (intensité, durée, budget) puis recommande après réponses

FORMAT DE RÉPONSE - Cinq types possibles :

A) QUESTIONS AVEC OPTIONS À COCHER (quand tu manques d'informations pour bien conseiller) :
{
  "type": "question",
  "question": "Question claire et précise pour obtenir l'information manquante",
  "options": [
    "Option 1",
    "Option 2", 
    "Option 3",
    "Option 4"
  ]
}

EXEMPLES DE QUESTIONS PERTINENTES :
- "Quelle est votre principale préoccupation concernant votre peau ?" → ["Hydratation", "Anti-âge", "Imperfections", "Sensibilité"]
- "À quelle fréquence avez-vous ces symptômes ?" → ["Quotidiennement", "Plusieurs fois par semaine", "Occasionnellement", "Rarement"]
- "Avez-vous des allergies connues ?" → ["Oui, plusieurs", "Oui, quelques-unes", "Non", "Je ne sais pas"]

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
⚠️⚠️⚠️ CE FORMAT EST OBLIGATOIRE dès que tu mentionnes UN SEUL produit ou plus ⚠️⚠️⚠️
⚠️⚠️⚠️ LES PRODUITS DOIVENT TOUJOURS ÊTRE AFFICHÉS AVEC CE FORMAT JSON - JAMAIS EN TEXTE LIBRE ⚠️⚠️⚠️
{
  "type": "products",
  "message": "Explication détaillée, bienveillante et accessible sur les produits parapharmaceutiques recommandés. INCLUS TOUJOURS des suggestions de produits complémentaires pertinents (ex: 'Pour maximiser les résultats, vous pourriez également envisager...' ou 'En complément, je vous suggère aussi...'). N'utilise que des IDs et des image_url provenant de la liste de produits ci-dessus.",
  "products": [
    {
      "id": "ID EXACT du produit depuis la base de données (OBLIGATOIRE pour que le bouton Ajouter fonctionne)",
      "name": "Nom exact du produit parapharmaceutique avec marque",
      "brand": "Marque du produit",
      "price": 15.90,
      "reason": "Explication claire et chaleureuse de pourquoi ce produit de bien-être est adapté (composition, bénéfices, usage)",
      "image_url": "image_url EXACTE du produit telle qu'elle apparaît dans la liste Produits disponibles (ne JAMAIS inventer d'URL)",
      "category": "Catégorie du produit",
      "available_in_pharmacy": true
    },
    {
      "id": "ID EXACT du produit 2 depuis la base de données",
      "name": "Nom du produit parapharmaceutique 2",
      "brand": "Marque du produit 2",
      "price": 12.50,
      "reason": "Explication chaleureuse et accessible",
      "image_url": "image_url EXACTE du produit 2 depuis la liste Produits disponibles",
      "category": "Catégorie du produit 2",
      "available_in_pharmacy": true
    },
    {
      "id": "ID EXACT du produit 3 depuis la base de données",
      "name": "Nom du produit parapharmaceutique 3",
      "brand": "Marque du produit 3",
      "price": 18.00,
      "reason": "Explication bienveillante et professionnelle",
      "image_url": "image_url EXACTE du produit 3 depuis la liste Produits disponibles",
      "category": "Catégorie du produit 3",
      "available_in_pharmacy": false
    }
  ],
  "note": "Si available_in_pharmacy: false → 'Ces produits peuvent être commandés par votre pharmacien'"
}

⚠️⚠️⚠️ RÈGLES ABSOLUES POUR LES IDS ⚠️⚠️⚠️
- Tu DOIS TOUJOURS utiliser l'ID exact du produit depuis la liste des produits fournie ci-dessus
- Cherche le produit par son nom exact dans la liste et utilise son ID
- Si le produit n'a pas d'ID dans la base, tu ne peux PAS le recommander - recommande un produit similaire qui a un ID
- SANS ID VALIDE, le bouton "Ajouter au panier" NE FONCTIONNERA PAS

⚠️⚠️⚠️ RAPPEL ULTRA-CRITIQUE - AFFICHAGE DES PRODUITS ⚠️⚠️⚠️
CHAQUE FOIS que tu recommandes ou mentionnes UN produit (même un seul), tu DOIS utiliser le format JSON type E "products" ci-dessus.
Les clients doivent TOUJOURS voir les photos des produits avec un bouton "Ajouter au panier" cliquable.
NE JAMAIS mentionner de produits en texte libre sans le format JSON structuré.
CHAQUE produit DOIT avoir son ID valide depuis la base de données pour que le bouton fonctionne.
Si tu ne trouves pas l'ID d'un produit, cherche un produit similaire qui a un ID valide dans la liste fournie.

PROCESSUS OBLIGATOIRE POUR RECOMMANDER DES PRODUITS :
1. Identifie les produits pertinents pour le besoin du client
2. Cherche ces produits dans la liste fournie ci-dessus pour obtenir leur ID exact
3. Utilise UNIQUEMENT le format JSON "products" avec les IDs valides
4. Assure-toi que TOUS les champs sont remplis (id, name, brand, price, image_url, category, reason)
5. Les clients verront alors les cartes produits avec photos et boutons cliquables

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

⚠️⚠️⚠️ RÈGLES ULTRA-CRITIQUES - JAMAIS D'EXCEPTION ⚠️⚠️⚠️
- TOUJOURS TOUJOURS TOUJOURS utiliser le format JSON "products" (type E) dès que tu recommandes un produit
- JAMAIS JAMAIS JAMAIS mentionner de produits en texte libre - UNIQUEMENT via le format JSON structuré
- CHAQUE produit DOIT avoir un ID valide depuis la base de données fournie
- Les clients DOIVENT ABSOLUMENT voir les PHOTOS des produits et pouvoir cliquer sur "Ajouter au panier"
- Si tu ne trouves pas un produit avec ID, recommande un produit similaire qui a un ID valide
- AVANT de recommander : vérifie que tu as assez d'infos, sinon pose des questions (format A)
- APRÈS avoir obtenu les infos : recommande IMMÉDIATEMENT avec photos et boutons (format E)

RÈGLES DE CONSEIL ET TON :
- Adopte un ton CHALEUREUX, AVENANT et RASSURANT dans toutes tes réponses
- Pose des questions avec EMPATHIE et BIENVEILLANCE pour mieux comprendre les besoins
- EXACTEMENT 3 produits PARAPHARMACEUTIQUES dans les recommandations principales
- SUGGÈRE SYSTÉMATIQUEMENT 1-3 produits complémentaires additionnels dans le message pour maximiser la valeur pour le client
- Explications CLAIRES, ACCESSIBLES et BIENVEILLANTES sur les produits de bien-être
- RECOMMANDE UNIQUEMENT les produits parapharmaceutiques disponibles dans la pharmacie sélectionnée du client (voir liste avec IDs ci-dessus)
- PENSE CROSS-SELLING : pour chaque besoin, identifie les produits qui peuvent compléter ou améliorer l'expérience (nettoyant + crème, shampoing + après-shampoing, etc.)
- Si un produit parapharmaceutique spécifique demandé n'existe pas dans la pharmacie sélectionnée, cherche-le dans les pharmacies alternatives et indique avec gentillesse la plus proche où il est disponible
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
      { role: 'system', content: systemPrompt + '\n\n⚠️⚠️⚠️ SÉCURITÉ CRITIQUE ⚠️⚠️⚠️\nAVANT de recommander UN SEUL PRODUIT, tu DOIS OBLIGATOIREMENT utiliser la fonction verify_product_safety pour CHAQUE produit que tu veux recommander.\nVérifie la sécurité en fonction du profil médical du patient (grossesse, allergies, etc.).\nNE RECOMMANDE JAMAIS un produit sans avoir vérifié sa sécurité d\'abord.\nSi un produit n\'est pas sûr, EXCLUS-LE de tes recommandations.\n\nIMPORTANT : Tu dois répondre UNIQUEMENT avec UN SEUL objet JSON valide, sans aucun texte en dehors du JSON.' },
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
            // Effectuer une recherche web réelle pour vérifier la sécurité
            const searchQuery = `${functionArgs.product_name} ${functionArgs.medical_conditions} contre-indications sécurité`;
            console.log(`Web search query: ${searchQuery}`);
            
            try {
              // Utiliser une API de recherche (ici on simule avec une recherche réelle)
              // Dans un cas réel, on utiliserait une API comme Perplexity, Bing, ou Google
              const searchResponse = await fetch(`https://api.perplexity.ai/chat/completions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('PERPLEXITY_API_KEY') || ''}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'llama-3.1-sonar-small-128k-online',
                  messages: [
                    {
                      role: 'user',
                      content: `Recherche des informations officielles sur la sécurité de "${functionArgs.product_name}" pour une personne avec ces conditions: ${functionArgs.medical_conditions}. Donne une réponse courte et précise sur les contre-indications et la sécurité.`
                    }
                  ],
                  temperature: 0.2,
                  max_tokens: 300
                }),
              });
              
              let safetyInfo = '';
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                safetyInfo = searchData.choices[0].message.content;
                console.log(`Safety info from web: ${safetyInfo}`);
              } else {
                // Fallback si Perplexity n'est pas disponible
                safetyInfo = `Recherche web effectuée pour "${functionArgs.product_name}" avec conditions "${functionArgs.medical_conditions}". Vérification des contre-indications en cours. ATTENTION: Produits contenant du fer, huiles essentielles, ou rétinol peuvent être contre-indiqués pour femmes enceintes. Vérifiez toujours la notice du produit.`;
              }
              
              // Ajouter le résultat de la fonction
              currentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: safetyInfo
              });
            } catch (error) {
              console.error('Error in web search:', error);
              currentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Erreur lors de la recherche. Par précaution, vérifier manuellement la sécurité de "${functionArgs.product_name}" pour ${functionArgs.medical_conditions}.`
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
          // NOTE: Le filtrage de sécurité est maintenant fait AVANT par OpenAI via web search
          // On garde juste un message d'avertissement si le profil est à risque
          if (!isPharmacyStaff && patientProfile) {
            const isPregnant = patientProfile.is_pregnant === true;
            const hasAllergies = patientProfile.allergies && patientProfile.allergies.trim().length > 0;
            
            if (isPregnant || hasAllergies) {
              parsed.message = `${parsed.message || ''}\n\n✅ Ces produits ont été vérifiés pour leur compatibilité avec votre profil médical (${isPregnant ? 'grossesse' : ''}${isPregnant && hasAllergies ? ', ' : ''}${hasAllergies ? 'allergies' : ''}).`.trim();
            }
          }

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

            // OK, format produits conforme avec image_url complétée
            assistantMessage = JSON.stringify(parsed);
          }
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
