import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Configuration hardcodée pour setup initial
    const email = 'aminikhalid@gmail.com';
    const password = '10031972';

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Trouver l'utilisateur par email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.users.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // Mettre à jour le mot de passe
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: password
      });
      userId = existingUser.id;
    } else {
      // Créer l'utilisateur
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });

      if (userError) {
        throw userError;
      }

      userId = userData.user.id;
    }

    // Ajouter le rôle admin
    const { error: roleError } = await supabaseAdmin
      .from('admin_roles')
      .upsert({
        user_id: userId,
        role: 'admin'
      });

    if (roleError) {
      throw roleError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Admin user configured successfully',
        userId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
