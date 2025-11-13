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

    // Get cart details with pharmacy info
    const { data: cart, error: cartError } = await supabaseClient
      .from('carts')
      .select(`
        *,
        pharmacy:pharmacies(name, phone)
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

    if (itemsError || !items) {
      throw new Error("Cart items not found");
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, username')
      .eq('id', cart.user_id)
      .single();

    const customerEmail = cart.notification_email || profile?.email || 'Client anonyme';
    const customerName = profile?.username || 'Client';
    const isDelivery = cart.delivery_method === 'delivery';

    // Prepare email content
    const itemsList = items.map(item => 
      `<li>${item.product_name} (${item.brand}) x${item.quantity} - ${Number(item.price).toFixed(2)}€</li>`
    ).join('');

    const totalAmount = items.reduce((sum, item) => 
      sum + (Number(item.price) * item.quantity), 0
    );

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
            .alert-box { background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196f3; }
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
            <h1>🛒 Nouvelle commande reçue</h1>
            
            <div class="alert-box">
              <p style="margin: 0; font-size: 16px;"><strong>Une nouvelle commande nécessite votre attention</strong></p>
            </div>
            
            <h2>Détails de la commande</h2>
            <ul>
              ${itemsList}
            </ul>
            
            <p class="total">Montant total : ${totalAmount.toFixed(2)}€</p>
            
            <h2>Informations client</h2>
            <div class="info-box">
              <p>
                <strong>Nom :</strong> ${customerName}<br>
                <strong>Email :</strong> ${customerEmail || 'Non fourni'}
              </p>
            </div>
            
            <h2>${isDelivery ? '🚚 Livraison' : '📍 Retrait en pharmacie'}</h2>
            <div class="info-box">
              ${isDelivery ? `
                <p><strong>Adresse de livraison :</strong></p>
                <p>
                  ${cart.delivery_address?.street}<br>
                  ${cart.delivery_address?.postal_code} ${cart.delivery_address?.city}<br>
                  ${cart.delivery_address?.country || 'France'}
                </p>
              ` : `
                <p>Le client viendra retirer sa commande en pharmacie.</p>
              `}
            </div>
            
            <p class="footer">
              Connectez-vous à votre espace pharmacien pour gérer cette commande.<br>
              L'équipe Arthur Pharmacie
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email to pharmacy (you would need pharmacy email in the database)
    // For now, we'll just send to a notification endpoint
    const { data: pharmacyUsers } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('pharmacy_id', cart.pharmacy_id);

    if (pharmacyUsers && pharmacyUsers.length > 0) {
      // Get emails of pharmacy staff
      const userIds = pharmacyUsers.map(u => u.user_id);
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('email')
        .in('id', userIds);

      if (profiles && profiles.length > 0) {
        const pharmacyEmails = profiles.map(p => p.email).filter(Boolean);
        
        // Send email notification using SMTP
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

        for (const email of pharmacyEmails) {
          await client.send({
            from: Deno.env.get('SMTP_USER') || '',
            to: email,
            subject: `Nouvelle commande - ${customerName}`,
            content: 'auto',
            html: emailHtml,
          });
        }

        await client.close();
        console.log('Pharmacy notification sent to:', pharmacyEmails.join(', '));
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error notifying pharmacy:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});