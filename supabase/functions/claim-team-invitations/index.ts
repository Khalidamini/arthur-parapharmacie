import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Récupérer l'email de l'utilisateur
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!profile?.email) {
      throw new Error("User email not found");
    }

    const userEmail = profile.email.trim().toLowerCase();

    // Chercher toutes les invitations en attente pour cet email
    const { data: invitations, error: invitationsError } = await supabaseClient
      .from("pharmacy_invitations")
      .select("*")
      .eq("email", userEmail)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    if (invitationsError) throw invitationsError;

    if (!invitations || invitations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, claimed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Attribuer les rôles pour chaque invitation
    let claimed = 0;
    for (const invitation of invitations) {
      // Vérifier si le rôle n'existe pas déjà
      const { data: existingRole } = await supabaseClient
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("pharmacy_id", invitation.pharmacy_id)
        .maybeSingle();

      if (existingRole) {
        // Marquer l'invitation comme acceptée mais ne pas créer de doublon
        await supabaseClient
          .from("pharmacy_invitations")
          .update({ 
            status: "accepted",
            accepted_at: new Date().toISOString()
          })
          .eq("id", invitation.id);
        continue;
      }

      // Créer le rôle
      const { error: roleError } = await supabaseClient
        .from("user_roles")
        .insert({
          user_id: user.id,
          pharmacy_id: invitation.pharmacy_id,
          role: invitation.role
        });

      if (roleError) {
        console.error("Error creating role:", roleError);
        continue;
      }

      // Marquer l'invitation comme acceptée
      await supabaseClient
        .from("pharmacy_invitations")
        .update({ 
          status: "accepted",
          accepted_at: new Date().toISOString()
        })
        .eq("id", invitation.id);

      claimed++;
    }

    console.log(`Claimed ${claimed} invitations for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, claimed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in claim-team-invitations:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
