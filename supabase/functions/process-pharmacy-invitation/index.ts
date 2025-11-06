import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessInvitationRequest {
  token: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { token, userId }: ProcessInvitationRequest = await req.json();

    console.log("Processing invitation for user:", userId, "with token:", token);

    // Get invitation details
    const { data: invitation, error: invitationError } = await supabaseClient
      .from("pharmacy_invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitation) {
      throw new Error("Invitation not found or already processed");
    }

    // Check if invitation expired
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseClient
        .from("pharmacy_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      throw new Error("Invitation has expired");
    }

    // Add user role
    const { error: roleError } = await supabaseClient
      .from("user_roles")
      .insert({
        user_id: userId,
        pharmacy_id: invitation.pharmacy_id,
        role: invitation.role,
      });

    if (roleError) {
      console.error("Error adding role:", roleError);
      throw roleError;
    }

    // Update invitation status
    const { error: updateError } = await supabaseClient
      .from("pharmacy_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("Error updating invitation:", updateError);
    }

    console.log("Invitation processed successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in process-pharmacy-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
