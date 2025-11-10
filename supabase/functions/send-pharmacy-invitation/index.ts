import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: string;
  pharmacyId: string;
  baseUrl?: string; // optional frontend base URL
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

    const { email, role, pharmacyId, baseUrl }: InvitationRequest = await req.json();

    console.log("Processing invitation for:", email, "role:", role);

    // Verify user has permission to invite
    const { data: userRole, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("pharmacy_id", pharmacyId)
      .single();

    if (roleError || !userRole || (userRole.role !== "owner" && userRole.role !== "admin")) {
      throw new Error("Unauthorized to invite members");
    }

    // Get pharmacy details
    const { data: pharmacy, error: pharmacyError } = await supabaseClient
      .from("pharmacies")
      .select("name")
      .eq("id", pharmacyId)
      .single();

    if (pharmacyError || !pharmacy) {
      throw new Error("Pharmacy not found");
    }

    // Check if user already exists and is already a member
    const { data: existingProfile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingRole } = await supabaseClient
        .from("user_roles")
        .select("id")
        .eq("user_id", existingProfile.id)
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle();

      if (existingRole) {
        throw new Error("User is already a member of this pharmacy");
      }
    }

    // Create invitation for both new and existing users
    const invitationToken = crypto.randomUUID();

    const { error: inviteError } = await supabaseClient
      .from("pharmacy_invitations")
      .insert({
        pharmacy_id: pharmacyId,
        invited_by: user.id,
        email: email,
        role: role,
        token: invitationToken,
      });

    if (inviteError) throw inviteError;

    // Send invitation email
    // Prefer explicit baseUrl from frontend, else infer from headers, else fallback to production domain
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
    const headerOrigin = req.headers.get("origin") || "";
    const headerReferer = req.headers.get("referer") || "";
    const refererOrigin = (headerReferer.match(/^https?:\/\/[^/]+/) || [""])[0];
    const chosenBase = (baseUrl && /^https?:\/\//.test(baseUrl) ? baseUrl : (headerOrigin || refererOrigin || (projectId ? `https://${projectId}.lovable.app` : ""))).replace(/\/$/, "");
    const invitationUrl = `${chosenBase}/pharmacy-invitation?token=${invitationToken}`;

    const emailResult = await resend.emails.send({
      from: "Arthur <onboarding@resend.dev>",
      to: [email],
      subject: `Invitation à rejoindre ${pharmacy.name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💊 Invitation à rejoindre ${pharmacy.name}</h1>
              </div>
              <div class="content">
                <p>Bonjour,</p>
                <p>Vous avez été invité à rejoindre l'équipe de <strong>${pharmacy.name}</strong> en tant que <strong>${role}</strong>.</p>
                <p>Pour accepter cette invitation, ${existingProfile ? 'connectez-vous avec votre compte existant' : 'créez votre compte'} en cliquant sur le bouton ci-dessous :</p>
                <center>
                  <a href="${invitationUrl}" class="button">Accepter l'invitation</a>
                </center>
                <p><small>Cette invitation expire dans 7 jours.</small></p>
                <p>Cordialement,<br>L'équipe Arthur</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailResult.error) {
      console.error("Error sending email:", emailResult.error);
      throw new Error(`Failed to send invitation email: ${emailResult.error.message}`);
    }

    console.log("Invitation sent successfully to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Invitation sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-pharmacy-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
