import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductData {
  name: string;
  brand: string;
  price: number;
  category: string;
  description?: string;
  stock_quantity: number;
  is_available: boolean;
}

// Fonction pour détecter les colonnes automatiquement
function detectColumns(headers: string[]): Record<string, number> {
  const columnMap: Record<string, number> = {};
  
  const patterns: Record<string, string[]> = {
    name: ['nom', 'name', 'produit', 'product', 'designation', 'libelle', 'article'],
    brand: ['marque', 'brand', 'fabricant', 'manufacturer', 'laboratoire'],
    price: ['prix', 'price', 'tarif', 'montant', 'pvp', 'pvttc'],
    category: ['categorie', 'category', 'famille', 'family', 'type', 'rayon'],
    description: ['description', 'desc', 'details', 'info'],
    stock_quantity: ['stock', 'quantity', 'quantite', 'qty', 'qte', 'inventaire'],
    is_available: ['disponible', 'available', 'dispo', 'actif', 'active'],
  };

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    
    for (const [field, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => normalizedHeader.includes(keyword))) {
        if (!columnMap[field]) {
          columnMap[field] = index;
        }
      }
    }
  });

  return columnMap;
}

// Fonction pour parser le CSV
function parseCSV(content: string): string[][] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => {
    // Support des délimiteurs communs
    const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
    return line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
  });
}

// Fonction pour nettoyer et normaliser les valeurs
function normalizeValue(value: string, type: 'string' | 'number' | 'boolean'): any {
  const cleanValue = value.trim();
  
  if (type === 'number') {
    // Gérer différents formats de nombres (1,234.56 ou 1 234,56)
    const normalized = cleanValue.replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }
  
  if (type === 'boolean') {
    const lower = cleanValue.toLowerCase();
    return ['oui', 'yes', 'true', '1', 'disponible', 'active'].includes(lower);
  }
  
  return cleanValue;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { pharmacy_id, file_content, file_name } = await req.json();

    if (!pharmacy_id || !file_content) {
      throw new Error('Missing pharmacy_id or file_content');
    }

    // Vérifier les permissions
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('pharmacy_id', pharmacy_id)
      .maybeSingle();

    if (!userRole) {
      throw new Error('User does not have permission to manage this pharmacy');
    }

    console.log(`Importing products for pharmacy ${pharmacy_id} from file ${file_name}`);

    // Décoder le contenu base64
    const decodedContent = atob(file_content);
    
    // Parser le fichier (on assume CSV pour l'instant, mais peut être étendu)
    const rows = parseCSV(decodedContent);
    
    if (rows.length < 2) {
      throw new Error('Le fichier doit contenir au moins une ligne de données');
    }

    // Première ligne = en-têtes
    const headers = rows[0];
    const columnMap = detectColumns(headers);

    console.log('Detected columns:', columnMap);

    if (!columnMap.name || !columnMap.price) {
      throw new Error('Impossible de détecter les colonnes obligatoires (nom et prix)');
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Traiter chaque ligne de données
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Extraire les données selon le mapping détecté
        const productData: ProductData = {
          name: normalizeValue(row[columnMap.name] || '', 'string'),
          brand: columnMap.brand !== undefined 
            ? normalizeValue(row[columnMap.brand] || '', 'string') 
            : 'Non spécifié',
          price: columnMap.price !== undefined
            ? normalizeValue(row[columnMap.price] || '0', 'number')
            : 0,
          category: columnMap.category !== undefined
            ? normalizeValue(row[columnMap.category] || '', 'string')
            : 'Autres',
          description: columnMap.description !== undefined
            ? normalizeValue(row[columnMap.description] || '', 'string')
            : undefined,
          stock_quantity: columnMap.stock_quantity !== undefined
            ? normalizeValue(row[columnMap.stock_quantity] || '0', 'number')
            : 0,
          is_available: columnMap.is_available !== undefined
            ? normalizeValue(row[columnMap.is_available] || 'true', 'boolean')
            : true,
        };

        // Validation basique
        if (!productData.name || productData.price <= 0) {
          results.skipped++;
          continue;
        }

        // Vérifier si le produit existe déjà
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('name', productData.name)
          .eq('brand', productData.brand)
          .maybeSingle();

        let productId: string;

        if (existingProduct) {
          // Mettre à jour le produit existant
          const { data: updatedProduct, error: updateError } = await supabase
            .from('products')
            .update({
              price: productData.price,
              category: productData.category,
              description: productData.description,
            })
            .eq('id', existingProduct.id)
            .select('id')
            .single();

          if (updateError) throw updateError;
          productId = updatedProduct.id;
        } else {
          // Créer un nouveau produit
          const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert({
              name: productData.name,
              brand: productData.brand,
              price: productData.price,
              category: productData.category,
              description: productData.description,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
          productId = newProduct.id;
        }

        // Créer ou mettre à jour la relation pharmacy_product
        const { data: existingPharmacyProduct } = await supabase
          .from('pharmacy_products')
          .select('id')
          .eq('pharmacy_id', pharmacy_id)
          .eq('product_id', productId)
          .maybeSingle();

        if (existingPharmacyProduct) {
          await supabase
            .from('pharmacy_products')
            .update({
              stock_quantity: productData.stock_quantity,
              is_available: productData.is_available,
            })
            .eq('id', existingPharmacyProduct.id);
        } else {
          await supabase
            .from('pharmacy_products')
            .insert({
              pharmacy_id,
              product_id: productId,
              stock_quantity: productData.stock_quantity,
              is_available: productData.is_available,
            });
        }

        results.imported++;
      } catch (error) {
        console.error(`Error processing row ${i}:`, error);
        results.errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        results.skipped++;
      }
    }

    console.log('Import complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        imported: results.imported,
        skipped: results.skipped,
        total: rows.length - 1,
        errors: results.errors.slice(0, 10), // Limiter à 10 erreurs pour ne pas surcharger
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in import-products-from-file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
