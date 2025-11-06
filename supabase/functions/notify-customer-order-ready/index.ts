import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    const subject = isDelivery 
      ? 'Votre colis a été expédié'
      : 'Votre commande est prête';

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
            .highlight-box { background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50; }
            .info-box { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .tracking { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
            ul { list-style: none; padding: 0; margin: 15px 0; }
            li { padding: 8px 0; border-bottom: 1px solid #eee; color: #666; }
            li:last-child { border-bottom: none; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
            strong { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${isDelivery ? '🚚' : '✅'} ${subject}</h1>
            <p>Bonjour ${customerName},</p>
            
            ${!isDelivery ? `
              <div class="highlight-box">
                <p style="margin: 0; font-size: 16px;"><strong>Bonne nouvelle ! Votre commande est prête à être retirée.</strong></p>
              </div>
              
              <h2>📍 Où retirer votre commande ?</h2>
              <div class="info-box">
                <p>
                  <strong>${cart.pharmacy.name}</strong><br>
                  ${cart.pharmacy.address}<br>
                  ${cart.pharmacy.city}<br>
                  ${cart.pharmacy.phone ? `Tél: ${cart.pharmacy.phone}` : ''}
                </p>
              </div>
              
              ${cart.pickup_message ? `
                <h2>💬 Message de la pharmacie</h2>
                <div class="info-box">
                  <p>${cart.pickup_message}</p>
                </div>
              ` : ''}
            ` : `
              <div class="highlight-box">
                <p style="margin: 0; font-size: 16px;"><strong>Votre colis a été expédié !</strong></p>
              </div>
              
              ${cart.shipping_tracking_number ? `
                <div class="tracking">
                  <p><strong>Numéro de suivi :</strong></p>
                  <p style="font-family: monospace; font-size: 16px; color: #333; margin: 10px 0;">${cart.shipping_tracking_number}</p>
                </div>
              ` : ''}
              
              <h2>📦 Informations de livraison</h2>
              <div class="info-box">
                <p>
                  ${cart.delivery_address?.street}<br>
                  ${cart.delivery_address?.postal_code} ${cart.delivery_address?.city}<br>
                  ${cart.delivery_address?.country || 'France'}
                </p>
              </div>
            `}
            
            <h2>Votre commande</h2>
            <ul>
              ${itemsList}
            </ul>
            
            <p class="footer">Merci pour votre confiance !<br>L'équipe Arthur Pharmacie</p>
          </div>
        </body>
      </html>
    `;

    // Send email using Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Arthur Pharmacie <onboarding@resend.dev>',
        to: [customerEmail],
        subject: subject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Failed to send customer notification:', errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    // Update cart notification timestamp
    await supabaseClient
      .from('carts')
      .update({ 
        notification_sent_at: new Date().toISOString(),
        ready_for_pickup: true
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
    console.error('Error notifying customer:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});