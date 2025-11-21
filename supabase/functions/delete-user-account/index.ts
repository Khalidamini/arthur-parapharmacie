import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('Deleting account for user:', user.id);

    // Supprimer toutes les données utilisateur dans l'ordre correct
    // Les messages seront supprimés en cascade avec les conversations
    await supabaseAdmin.from('recommendations').delete().eq('user_id', user.id);
    await supabaseAdmin.from('conversations').delete().eq('user_id', user.id);
    await supabaseAdmin.from('cart_items').delete().eq('user_id', user.id);
    await supabaseAdmin.from('carts').delete().eq('user_id', user.id);
    await supabaseAdmin.from('user_pharmacy_affiliation').delete().eq('user_id', user.id);
    await supabaseAdmin.from('profiles').delete().eq('id', user.id);

    // Supprimer le compte auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      throw deleteError;
    }

    console.log('Account successfully deleted for user:', user.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in delete-user-account function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
