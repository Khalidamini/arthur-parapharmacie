import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: "owner" | "admin" | "promotion_manager";
  pharmacyId: string;
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

    const { email, role, pharmacyId }: InvitationRequest = await req.json();

    // Validation de l'email
    const emailTrimmed = (email || '').trim().toLowerCase();
    const asciiOnly = /^[\x00-\x7F]+$/.test(emailTrimmed);
    const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailTrimmed || emailTrimmed.length > 255 || !basicEmail.test(emailTrimmed) || !asciiOnly) {
      throw new Error("Adresse e-mail invalide. Utilisez une adresse sans accents.");
    }

    // Vérifier que l'utilisateur a la permission d'inviter
    const { data: userRole, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("pharmacy_id", pharmacyId)
      .single();

    if (roleError || !userRole || (userRole.role !== "owner" && userRole.role !== "admin")) {
      throw new Error("Unauthorized to invite members");
    }

    // Vérifier que l'email n'est pas déjà membre
    const { data: existingProfile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("email", emailTrimmed)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingRole } = await supabaseClient
        .from("user_roles")
        .select("id")
        .eq("user_id", existingProfile.id)
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle();

      if (existingRole) {
        throw new Error("Cet email est déjà membre de cette pharmacie");
      }
    }

    // Créer l'invitation
    const invitationToken = crypto.randomUUID();

    const { error: inviteError } = await supabaseClient
      .from("pharmacy_invitations")
      .insert({
        pharmacy_id: pharmacyId,
        invited_by: user.id,
        email: emailTrimmed,
        role: role,
        token: invitationToken,
      });

    if (inviteError) throw inviteError;

    // Récupérer le nom de la pharmacie
    const { data: pharmacy } = await supabaseClient
      .from("pharmacies")
      .select("name")
      .eq("id", pharmacyId)
      .single();

    const pharmacyName = pharmacy?.name || "la pharmacie";
    
    // Construire le lien d'invitation vers la page de login/register
    const baseUrl = req.headers.get("origin") || "";
    const invitationUrl = `${baseUrl}/pharmacy-login?invitation=${invitationToken}`;

    const roleLabels: Record<string, string> = {
      owner: "Propriétaire",
      admin: "Administrateur",
      promotion_manager: "Gestionnaire de promotions"
    };

    // Construire le message d'invitation à copier
    const invitationMessage = `🏥 Invitation à rejoindre ${pharmacyName}

Bonjour,

Vous avez été invité(e) à rejoindre l'équipe de ${pharmacyName} en tant que ${roleLabels[role]}.

Pour accepter cette invitation :
1. Rendez-vous sur : ${invitationUrl}
2. Connectez-vous avec l'email : ${emailTrimmed}
   (Ou créez votre compte si vous n'en avez pas encore)
3. Vos accès seront automatiquement activés

Cette invitation expire dans 7 jours.

Cordialement,
L'équipe Arthur`;

    console.log("Invitation created for:", emailTrimmed);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitationMessage,
        invitationUrl
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in create-team-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
