import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { pharmacy_id, error, timestamp } = await req.json();

    console.log('Connector error received:', {
      pharmacy_id,
      error,
      timestamp,
      user_id: user.id
    });

    // Vérifier que l'utilisateur a accès à cette pharmacie
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('pharmacy_id', pharmacy_id)
      .maybeSingle();

    if (!userRole) {
      throw new Error('User does not have permission for this pharmacy');
    }

    // Log l'erreur (pourrait être stocké dans une table dédiée si nécessaire)
    console.error(`Connector error for pharmacy ${pharmacy_id}:`, error);

    // TODO: Envoyer une notification à l'admin si erreur critique
    // TODO: Stocker dans une table connector_errors si besoin de suivi

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Error logged successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in connector-error-logs:', error);
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
