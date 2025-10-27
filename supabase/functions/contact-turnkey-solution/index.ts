import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Contact request from user:', user.id);

    const { pharmacy_id, pharmacy_name, contact_name, phone, software_name, message } = await req.json();

    if (!pharmacy_id || !pharmacy_name || !contact_name || !phone) {
      throw new Error('Missing required fields');
    }

    // Verify user has permission to this pharmacy
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('pharmacy_id', pharmacy_id)
      .single();

    if (!userRole) {
      throw new Error('User does not have permission to this pharmacy');
    }

    // Send email to Arthur support team
    const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
            h1 { color: #333; font-size: 24px; margin-bottom: 20px; }
            .info { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #333; }
            .value { color: #666; }
            p { color: #666; line-height: 1.6; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 Demande de solution clé en main</h1>
            <p>Une nouvelle pharmacie souhaite installer le service de synchronisation Arthur.</p>
            
            <div class="info">
              <div class="info-row">
                <span class="label">Pharmacie :</span>
                <span class="value">${pharmacy_name}</span>
              </div>
              <div class="info-row">
                <span class="label">Contact :</span>
                <span class="value">${contact_name}</span>
              </div>
              <div class="info-row">
                <span class="label">Téléphone :</span>
                <span class="value">${phone}</span>
              </div>
              <div class="info-row">
                <span class="label">Email :</span>
                <span class="value">${user.email}</span>
              </div>
              ${software_name ? `
              <div class="info-row">
                <span class="label">Logiciel de gestion :</span>
                <span class="value">${software_name}</span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="label">Pharmacy ID :</span>
                <span class="value">${pharmacy_id}</span>
              </div>
              <div class="info-row">
                <span class="label">User ID :</span>
                <span class="value">${user.id}</span>
              </div>
            </div>

            ${message ? `
            <div class="info">
              <div class="label">Message :</div>
              <p class="value">${message}</p>
            </div>
            ` : ''}

            <p style="margin-top: 30px; color: #999; font-size: 12px;">
              Cette demande a été générée automatiquement depuis l'interface Arthur.
            </p>
          </div>
        </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'Arthur Sync <onboarding@resend.dev>',
      to: ['support-pharmacie@arthur.fr'], // Replace with your actual support email
      subject: `🚀 Nouvelle demande de solution clé en main - ${pharmacy_name}`,
      html,
      replyTo: user.email || undefined,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      throw new Error('Failed to send email');
    }

    console.log('Contact request sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Votre demande a été envoyée avec succès. Notre équipe vous contactera sous 24-48h.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in contact-turnkey-solution:', error);
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
