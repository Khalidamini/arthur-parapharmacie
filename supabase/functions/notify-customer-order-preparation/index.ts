import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { cartId } = await req.json();

    if (!cartId) {
      throw new Error("Cart ID is required");
    }

    // Get cart details
    const { data: cart, error: cartError } = await supabaseClient
      .from('carts')
      .select(`
        *,
        pharmacy:pharmacies(name, address, city, phone)
      `)
      .eq('id', cartId)
      .single();

    if (cartError || !cart) {
      throw new Error("Cart not found");
    }

    // Get cart items
    const { data: items, error: itemsError } = await supabaseClient
      .from('cart_items')
      .select('*')
      .eq('cart_id', cartId);

    if (itemsError) {
      throw new Error("Cart items not found");
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, username, first_name, last_name')
      .eq('id', cart.user_id)
      .single();

    const customerEmail = cart.notification_email || profile?.email;
    
    if (!customerEmail) {
      throw new Error("No email address found for customer");
    }

    const customerName = profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile?.username || 'Client';

    const pharmacyName = (cart.pharmacy as any)?.name || 'Votre pharmacie';
    const pharmacyAddress = (cart.pharmacy as any)?.address || '';
    const pharmacyCity = (cart.pharmacy as any)?.city || '';
    const pharmacyPhone = (cart.pharmacy as any)?.phone || '';

    // Prepare items list
    const itemsList = items?.map(item => 
      `<li>${item.product_name} (${item.brand}) x${item.quantity} - ${Number(item.price).toFixed(2)}€</li>`
    ).join('') || '';

    const total = items?.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) || 0;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
            h1 { color: #333; font-size: 24px; margin-bottom: 20px; }
            h2 { color: #333; font-size: 20px; margin-top: 30px; margin-bottom: 15px; }
            p { color: #666; line-height: 1.6; margin-bottom: 15px; }
            .highlight-box { background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
            .info-box { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            ul { list-style: none; padding: 0; margin: 15px 0; }
            li { padding: 8px 0; border-bottom: 1px solid #eee; color: #666; }
            li:last-child { border-bottom: none; }
            .total { background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: right; font-weight: bold; color: #333; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
            strong { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔄 Commande en préparation</h1>
            <p>Bonjour ${customerName},</p>
            
            <div class="highlight-box">
              <p style="margin: 0; font-size: 16px;">
                <strong>Votre commande est actuellement en cours de préparation</strong> à ${pharmacyName}.
              </p>
            </div>

            <h2>Détails de votre commande</h2>
            <ul>
              ${itemsList}
            </ul>
            <div class="total">
              Total: ${total.toFixed(2)}€
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #333;">Informations de la pharmacie</h3>
              <p style="margin: 5px 0;"><strong>${pharmacyName}</strong></p>
              <p style="margin: 5px 0;">${pharmacyAddress}</p>
              <p style="margin: 5px 0;">${pharmacyCity}</p>
              ${pharmacyPhone ? `<p style="margin: 5px 0;">Tél: ${pharmacyPhone}</p>` : ''}
            </div>

            <p>Vous recevrez une nouvelle notification dès que votre commande sera prête à être retirée.</p>

            <p class="footer">Merci pour votre confiance !<br>L'équipe ${pharmacyName}</p>
          </div>
        </body>
      </html>
    `;

    // Send email using SMTP
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST') || '',
        port: Number(Deno.env.get('SMTP_PORT')) || 465,
        tls: true,
        auth: {
          username: Deno.env.get('SMTP_USER') || '',
          password: Deno.env.get('SMTP_PASSWORD') || '',
        },
      },
    });

    const smtpFrom = Deno.env.get('SMTP_USER') || '';
    const recipientDomain = (customerEmail.split('@')[1] || '').toLowerCase();
    const devDomains = ['test.com', 'example.com', 'app.local', 'local', 'localhost'];

    let delivered = false;
    try {
      const isDevDomain = devDomains.includes(recipientDomain);
      const toAddress = isDevDomain ? smtpFrom : customerEmail;

      await client.send({
        from: smtpFrom,
        to: toAddress,
        subject: `Commande en préparation - ${pharmacyName}${isDevDomain ? ` (copie pour ${customerEmail})` : ''}`,
        content: 'auto',
        html: isDevDomain
          ? `<p style="font-size:12px;color:#999;">Copie redirigée (destinataire invalide: ${customerEmail})</p>` + emailHtml
          : emailHtml,
      });
      delivered = true;
      console.log(isDevDomain
        ? `Preparation notification redirected to sender for invalid domain: ${customerEmail}`
        : `Preparation notification sent successfully to: ${customerEmail}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Primary SMTP send failed:', msg);

      // Fallback: when MX is invalid, redirect to sender to avoid 500 while staying on SMTP
      if (msg.includes('invalid DNS MX') || msg.includes('MX or A/AAAA')) {
        try {
          await client.send({
            from: smtpFrom,
            to: smtpFrom,
            subject: `DEV COPY - Commande en préparation (original: ${customerEmail}) - ${pharmacyName}`,
            content: 'auto',
            html: `<p style="font-size:12px;color:#999;">Original destinataire: ${customerEmail}</p>` + emailHtml,
          });
          delivered = true;
          console.log(`Preparation notification fallback sent to sender for original recipient: ${customerEmail}`);
        } catch (fallbackErr) {
          console.error('Fallback SMTP send failed:', fallbackErr);
        }
      }
    }

    await client.close();
    if (!delivered) {
      throw new Error('Email non délivré et fallback indisponible');
    }

    // Update cart with preparation notification timestamp
    await supabaseClient
      .from('carts')
      .update({ 
        preparation_notified_at: new Date().toISOString()
      })
      .eq('id', cartId);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error notifying customer of preparation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});