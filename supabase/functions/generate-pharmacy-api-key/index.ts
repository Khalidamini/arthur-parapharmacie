import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateSecureApiKey(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  const base64 = btoa(String.fromCharCode(...buffer));
  // Créer une clé au format arthur_xxxxx
  return 'arthur_' + base64.replace(/[+/=]/g, '').substring(0, 40);
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

    const { pharmacy_id } = await req.json();

    if (!pharmacy_id) {
      throw new Error('Missing pharmacy_id');
    }

    console.log('Generating API key for pharmacy:', pharmacy_id);

    // Vérifier que l'utilisateur a les droits (owner ou admin)
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('pharmacy_id', pharmacy_id)
      .maybeSingle();

    if (!userRole || (userRole.role !== 'owner' && userRole.role !== 'admin')) {
      throw new Error('Insufficient permissions. Only owners and admins can generate API keys.');
    }

    // Vérifier si une clé existe déjà
    const { data: existingKey } = await supabase
      .from('pharmacy_api_keys')
      .select('api_key')
      .eq('pharmacy_id', pharmacy_id)
      .maybeSingle();

    if (existingKey) {
      // Retourner la clé existante
      console.log('Returning existing API key');
      return new Response(
        JSON.stringify({
          success: true,
          api_key: existingKey.api_key,
          existing: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Générer une nouvelle clé
    const apiKey = generateSecureApiKey();

    const { data: newKey, error: insertError } = await supabase
      .from('pharmacy_api_keys')
      .insert({
        pharmacy_id,
        api_key: apiKey
      })
      .select('api_key')
      .single();

    if (insertError) throw insertError;

    console.log('API key generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        api_key: newKey.api_key,
        existing: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-pharmacy-api-key:', error);
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
