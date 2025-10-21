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

    const pharmacyAccounts = [
      {
        email: 'pharmacie.centre@test.com',
        password: 'Pharmacie123!',
        pharmacyId: 'ef7790c3-5f77-46d3-aaee-34ac6c394c6c',
        pharmacyName: 'Pharmacie du Centre (Paris)'
      },
      {
        email: 'pharmacie.lilas@test.com',
        password: 'Pharmacie123!',
        pharmacyId: '5026705f-2346-40d5-b3b5-5b1952ce2462',
        pharmacyName: 'Pharmacie des Lilas (Lyon)'
      },
      {
        email: 'pharmacie.stmichel@test.com',
        password: 'Pharmacie123!',
        pharmacyId: '7cffbfbd-d95d-4e07-aabc-598c8de566e4',
        pharmacyName: 'Pharmacie Saint-Michel (Marseille)'
      },
      {
        email: 'pharmacie.rhumont@test.com',
        password: 'Pharmacie123!',
        pharmacyId: '7fd0d116-b640-4823-82bb-0b5759ec9084',
        pharmacyName: 'Pharmacie du Rhumont (Remiremont)'
      }
    ];

    const results = [];

    for (const account of pharmacyAccounts) {
      // Essayer de créer l'utilisateur
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      });

      let userId = userData?.user?.id;

      // Si l'utilisateur existe déjà, récupérer son ID
      if (userError && userError.message.includes('already been registered')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users.find(u => u.email === account.email);
        
        if (existingUser) {
          userId = existingUser.id;
          console.log(`User ${account.email} already exists, using existing user ID`);
        } else {
          results.push({
            email: account.email,
            success: false,
            error: 'User exists but could not be found'
          });
          continue;
        }
      } else if (userError) {
        console.error(`Error creating user ${account.email}:`, userError);
        results.push({
          email: account.email,
          success: false,
          error: userError.message
        });
        continue;
      }

      if (!userId) {
        results.push({
          email: account.email,
          success: false,
          error: 'No user ID available'
        });
        continue;
      }

      // Vérifier si le rôle existe déjà
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('pharmacy_id', account.pharmacyId)
        .single();

      if (existingRole) {
        results.push({
          email: account.email,
          userId: userId,
          pharmacyName: account.pharmacyName,
          success: true,
          message: 'Role already exists'
        });
        continue;
      }

      // Attribuer le rôle de propriétaire de pharmacie
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          pharmacy_id: account.pharmacyId,
          role: 'owner'
        });

      if (roleError) {
        console.error(`Error assigning role to ${account.email}:`, roleError);
        results.push({
          email: account.email,
          userId: userId,
          success: false,
          error: `User exists but role assignment failed: ${roleError.message}`
        });
        continue;
      }

      results.push({
        email: account.email,
        userId: userId,
        pharmacyName: account.pharmacyName,
        success: true
      });
    }

    return new Response(
      JSON.stringify({
        message: 'Pharmacy test accounts creation completed',
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
