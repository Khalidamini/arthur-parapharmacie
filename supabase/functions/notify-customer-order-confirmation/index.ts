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

    const totalAmount = items?.reduce((sum, item) => 
      sum + (Number(item.price) * item.quantity), 0
    ) || 0;

    const emailHtml = `
      <h2>Confirmation de votre commande</h2>
      <p>Bonjour ${customerName},</p>
      <p>Merci pour votre commande auprès de <strong>${cart.pharmacy.name}</strong> !</p>
      
      <h3>Résumé de votre commande :</h3>
      <ul style="list-style: none; padding: 0;">
        ${itemsList}
      </ul>
      
      <p><strong>Montant total :</strong> ${totalAmount.toFixed(2)}€</p>
      <p><strong>Mode de récupération :</strong> ${isDelivery ? 'Livraison à domicile' : 'Retrait en pharmacie'}</p>
      
      ${!isDelivery ? `
        <h3>Adresse de retrait :</h3>
        <p>
          <strong>${cart.pharmacy.name}</strong><br>
          ${cart.pharmacy.address}<br>
          ${cart.pharmacy.city}<br>
          ${cart.pharmacy.phone ? `Tél: ${cart.pharmacy.phone}` : ''}
        </p>
        <p>Vous recevrez une notification par email lorsque votre commande sera prête à être retirée.</p>
      ` : `
        <h3>Adresse de livraison :</h3>
        <p>
          ${cart.delivery_address?.street}<br>
          ${cart.delivery_address?.postal_code} ${cart.delivery_address?.city}<br>
          ${cart.delivery_address?.country || 'France'}
        </p>
        <p>Vous recevrez un email avec les informations de suivi dès que votre colis sera expédié.</p>
      `}
      
      <p>Merci pour votre confiance !</p>
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
        subject: 'Confirmation de votre commande',
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Failed to send confirmation email:', errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    console.log('Order confirmation email sent to:', customerEmail);

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