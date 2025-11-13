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
      .select('email, username')
      .eq('id', cart.user_id)
      .single();

    const customerEmail = cart.notification_email || profile?.email;
    
    if (!customerEmail) {
      throw new Error("No email address found for customer");
    }

    const customerName = profile?.username || 'Client';
    const isDelivery = cart.delivery_method === 'delivery';

    // Prepare items list
    const itemsList = items?.map(item => 
      `<li>${item.product_name} (${item.brand}) x${item.quantity} - ${Number(item.price).toFixed(2)}€</li>`
    ).join('') || '';

    const totalAmount = items?.reduce((sum, item) => 
      sum + (Number(item.price) * item.quantity), 0
    ) || 0;

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
            .info-box { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .total { font-size: 18px; font-weight: bold; color: #333; margin-top: 20px; }
            ul { list-style: none; padding: 0; margin: 15px 0; }
            li { padding: 8px 0; border-bottom: 1px solid #eee; color: #666; }
            li:last-child { border-bottom: none; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
            strong { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Confirmation de votre commande</h1>
            <p>Bonjour ${customerName},</p>
            <p>Merci pour votre commande auprès de <strong>${cart.pharmacy.name}</strong> !</p>
            
            <h2>Résumé de votre commande</h2>
            <ul>
              ${itemsList}
            </ul>
            
            <p class="total">Montant total : ${totalAmount.toFixed(2)}€</p>
            
            <div class="info-box">
              <p><strong>Mode de récupération :</strong> ${isDelivery ? 'Livraison à domicile' : 'Retrait en pharmacie'}</p>
              
              ${!isDelivery ? `
                <h3 style="margin-top: 20px;">📍 Adresse de retrait</h3>
                <p>
                  <strong>${cart.pharmacy.name}</strong><br>
                  ${cart.pharmacy.address}<br>
                  ${cart.pharmacy.city}<br>
                  ${cart.pharmacy.phone ? `Tél: ${cart.pharmacy.phone}` : ''}
                </p>
                <p style="color: #2754C5;">Vous recevrez une notification par email lorsque votre commande sera prête à être retirée.</p>
              ` : `
                <h3 style="margin-top: 20px;">🚚 Adresse de livraison</h3>
                <p>
                  ${cart.delivery_address?.street}<br>
                  ${cart.delivery_address?.postal_code} ${cart.delivery_address?.city}<br>
                  ${cart.delivery_address?.country || 'France'}
                </p>
                <p style="color: #2754C5;">Vous recevrez un email avec les informations de suivi dès que votre colis sera expédié.</p>
              `}
            </div>
            
            <p class="footer">Merci pour votre confiance !<br>L'équipe Arthur Pharmacie</p>
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

    let emailStatus = 'not_sent';
    try {
      const isDevDomain = devDomains.includes(recipientDomain);
      const toAddress = isDevDomain ? smtpFrom : customerEmail;

      await client.send({
        from: smtpFrom,
        to: toAddress,
        subject: isDevDomain ? `Confirmation de votre commande (copie pour ${customerEmail})` : 'Confirmation de votre commande',
        content: 'auto',
        html: isDevDomain
          ? `<p style="font-size:12px;color:#999;">Copie redirigée (destinataire invalide: ${customerEmail})</p>` + emailHtml
          : emailHtml,
      });
      emailStatus = 'sent';
      console.log(isDevDomain
        ? `Confirmation redirected to sender for invalid domain: ${customerEmail}`
        : `Order confirmation email sent to: ${customerEmail}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Primary SMTP send failed:', msg);

      if (msg.includes('invalid DNS MX') || msg.includes('MX or A/AAAA') || msg.includes('mailbox unavailable')) {
        try {
          await client.send({
            from: smtpFrom,
            to: smtpFrom,
            subject: `DEV COPY - Confirmation de commande (original: ${customerEmail})`,
            content: 'auto',
            html: `<p style="font-size:12px;color:#999;">Original destinataire: ${customerEmail}</p>` + emailHtml,
          });
          emailStatus = 'sent_to_fallback';
          console.log(`Confirmation fallback sent to sender for original recipient: ${customerEmail}`);
        } catch (fallbackErr) {
          emailStatus = 'failed';
          console.error('Fallback SMTP send also failed:', fallbackErr);
        }
      } else {
        emailStatus = 'failed';
      }
    }

    await client.close();
    console.log(`Email status: ${emailStatus}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending confirmation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});