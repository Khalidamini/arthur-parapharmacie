import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Génère un embedding vectoriel pour un texte via OpenAI
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embeddings API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Traite les entrées par batch pour régénérer les embeddings
 */
async function processBatch(
  supabase: any,
  entries: any[],
  apiKey: string,
  onProgress: (processed: number, total: number, current: string) => void
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    try {
      onProgress(i + 1, entries.length, entry.question_original.substring(0, 50));
      
      // Générer l'embedding
      const embedding = await generateEmbedding(entry.question_original, apiKey);
      
      // Mettre à jour l'entrée
      const { error } = await supabase
        .from('arthur_knowledge_base')
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', entry.id);

      if (error) {
        console.error(`❌ Erreur mise à jour ${entry.id}:`, error);
        errors++;
      } else {
        success++;
      }

      // Rate limiting: pause de 100ms entre chaque requête
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Erreur génération embedding ${entry.id}:`, error);
      errors++;
    }
  }

  return { success, errors };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Démarrage de la régénération des embeddings...');

    // Récupérer toutes les entrées sans embedding
    const { data: entriesWithoutEmbedding, error: fetchError } = await supabase
      .from('arthur_knowledge_base')
      .select('id, question_original')
      .is('embedding', null)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Erreur récupération des entrées: ${fetchError.message}`);
    }

    if (!entriesWithoutEmbedding || entriesWithoutEmbedding.length === 0) {
      console.log('✅ Aucune entrée à traiter');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Aucune entrée sans embedding trouvée',
          processed: 0,
          errors: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const total = entriesWithoutEmbedding.length;
    console.log(`📊 ${total} entrées à traiter`);

    // Diviser en batches de 50 pour éviter les timeouts
    const BATCH_SIZE = 50;
    let totalSuccess = 0;
    let totalErrors = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = entriesWithoutEmbedding.slice(i, Math.min(i + BATCH_SIZE, total));
      console.log(`🔄 Traitement batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(total/BATCH_SIZE)}`);
      
      const result = await processBatch(
        supabase,
        batch,
        OPENAI_API_KEY,
        (processed, batchTotal, current) => {
          console.log(`   ⏳ ${i + processed}/${total} - ${current}...`);
        }
      );

      totalSuccess += result.success;
      totalErrors += result.errors;
    }

    console.log(`✅ Régénération terminée: ${totalSuccess} succès, ${totalErrors} erreurs`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Embeddings régénérés avec succès`,
        processed: totalSuccess,
        errors: totalErrors,
        total: total
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erreur dans regenerate-embeddings:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
