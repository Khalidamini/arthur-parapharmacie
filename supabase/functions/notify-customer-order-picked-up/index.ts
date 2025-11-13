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

    console.log(`Processing pickup confirmation for cart: ${cartId}`);

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
      console.error("Cart not found:", cartError);
      throw new Error("Cart not found");
    }

    // Get cart items
    const { data: items, error: itemsError } = await supabaseClient
      .from('cart_items')
      .select('*')
      .eq('cart_id', cartId);

    if (itemsError) {
      console.error("Cart items not found:", itemsError);
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
      console.error("No email address found for customer");
      throw new Error("No email address found for customer");
    }

    const customerName = profile?.first_name 
      ? `${profile.first_name} ${profile.last_name || ''}`
      : profile?.username || 'Client';

    // Prepare items list
    const itemsList = items?.map(item => 
      `<li>${item.product_name} (${item.brand}) x${item.quantity} - ${Number(item.price).toFixed(2)}€</li>`
    ).join('') || '';

    const totalAmount = items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
    const pickupDate = new Date().toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

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
            .highlight-box { background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196f3; }
            .info-box { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            ul { list-style: none; padding: 0; margin: 15px 0; }
            li { padding: 8px 0; border-bottom: 1px solid #eee; color: #666; }
            li:last-child { border-bottom: none; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
            strong { color: #333; }
            .total { font-size: 20px; font-weight: bold; color: #2196f3; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Commande retirée avec succès</h1>
            <p>Bonjour ${customerName},</p>
            
            <div class="highlight-box">
              <p style="margin: 0; font-size: 16px;"><strong>Votre commande a bien été retirée à la pharmacie.</strong></p>
            </div>
            
            <h2>📋 Récapitulatif de votre commande</h2>
            <div class="info-box">
              <p><strong>Date et heure du retrait :</strong><br>${pickupDate}</p>
              <p><strong>Pharmacie :</strong><br>
                ${cart.pharmacy?.name || 'Pharmacie'}<br>
                ${cart.pharmacy?.address || ''}<br>
                ${cart.pharmacy?.city || ''}
              </p>
            </div>

            <h2>🛍️ Produits retirés</h2>
            <ul>
              ${itemsList}
            </ul>
            
            <div class="total">
              Total : ${totalAmount.toFixed(2)}€
            </div>

            <p style="margin-top: 30px;">Merci d'avoir choisi notre pharmacie !</p>
            <p>Si vous avez des questions concernant les produits que vous avez retirés, n'hésitez pas à contacter la pharmacie${cart.pharmacy?.phone ? ` au ${cart.pharmacy.phone}` : ''}.</p>

            <div class="footer">
              <p>Cet email est un accusé de réception automatique de votre retrait de commande.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email using SMTP
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "smtp.ionos.fr",
        port: Number(Deno.env.get("SMTP_PORT")) || 465,
        tls: true,
        auth: {
          username: Deno.env.get("SMTP_USER") || "contact@gptprive.com",
          password: Deno.env.get("SMTP_PASSWORD") || "",
        },
      },
    });

    await client.send({
      from: Deno.env.get("SMTP_USER") || "contact@gptprive.com",
      to: customerEmail,
      subject: "Confirmation de retrait de commande",
      content: emailHtml,
      html: emailHtml,
    });

    await client.close();

    console.log(`Pickup confirmation email sent successfully to ${customerEmail}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-customer-order-picked-up:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
