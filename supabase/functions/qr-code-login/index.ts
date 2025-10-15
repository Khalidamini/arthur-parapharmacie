import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QrCodeLoginRequest {
  qrCodeNumber: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { qrCodeNumber }: QrCodeLoginRequest = await req.json();

    if (!qrCodeNumber || qrCodeNumber.length !== 8) {
      throw new Error("Numéro de QR code invalide");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Find the profile with this QR code number
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("qr_code_number", qrCodeNumber)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError);
      throw new Error("Numéro de QR code invalide");
    }

    // Get the user's email
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      profile.id
    );

    if (userError || !user || !user.email) {
      console.error("User not found:", userError);
      throw new Error("Utilisateur non trouvé");
    }

    // Update the user's password to be the QR code number
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: qrCodeNumber }
    );

    if (updateError) {
      console.error("Failed to update password:", updateError);
      throw new Error("Erreur lors de la mise à jour du mot de passe");
    }

    // Return the email so the client can sign in
    return new Response(
      JSON.stringify({ email: user.email }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in qr-code-login:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
