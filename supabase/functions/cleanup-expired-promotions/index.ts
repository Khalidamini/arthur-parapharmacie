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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting cleanup of expired promotions...');

    // Supprimer les promotions dont la date d'expiration est dépassée
    const { data: deletedPromotions, error } = await supabaseAdmin
      .from('promotions')
      .delete()
      .lt('valid_until', new Date().toISOString())
      .select();

    if (error) {
      console.error('Error deleting expired promotions:', error);
      throw error;
    }

    const deletedCount = deletedPromotions?.length || 0;
    console.log(`Successfully deleted ${deletedCount} expired promotion(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount,
        deletedPromotions,
        message: `Deleted ${deletedCount} expired promotion(s)`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in cleanup-expired-promotions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
