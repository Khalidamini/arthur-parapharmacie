import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Script Python standalone encodé en base64
const PYTHON_CONNECTOR = `IyEvdXNyL2Jpbi9lbnYgcHl0aG9uMwo...`; // Le fichier sera uploadé manuellement

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Vérifier que l'utilisateur est admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Vérifier le rôle admin
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    console.log('Uploading connector files to storage...');

    // Upload du fichier Python standalone
    const pythonFile = new TextEncoder().encode(atob(PYTHON_CONNECTOR));
    
    const { error: uploadError } = await supabase.storage
      .from('connector-updates')
      .upload('arthur-connector.py', pythonFile, {
        contentType: 'text/x-python',
        upsert: true
      });

    if (uploadError) throw uploadError;

    console.log('Connector files uploaded successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Connector files uploaded',
        files: [
          'arthur-connector.py'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in upload-connector-files:', error);
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
