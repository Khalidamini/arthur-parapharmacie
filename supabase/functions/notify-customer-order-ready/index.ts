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

    let emailHtml = '';
    let emailSubject = '';

    if (isDelivery) {
      emailSubject = 'Votre commande a été expédiée';
      emailHtml = `
        <h2>Votre commande est en route !</h2>
        <p>Bonjour ${customerName},</p>
        <p>Votre commande auprès de <strong>${cart.pharmacy.name}</strong> a été expédiée.</p>
        
        ${cart.shipping_tracking_number ? `
          <p><strong>Numéro de suivi:</strong> ${cart.shipping_tracking_number}</p>
          <p>Vous pouvez suivre votre colis en temps réel.</p>
        ` : ''}
        
        ${cart.shipping_label_url ? `
          <p><a href="${cart.shipping_label_url}">Télécharger le bon de livraison</a></p>
        ` : ''}
        
        <p>Adresse de livraison:</p>
        <p>
          ${cart.delivery_address?.street}<br>
          ${cart.delivery_address?.postal_code} ${cart.delivery_address?.city}<br>
          ${cart.delivery_address?.country || 'France'}
        </p>
        
        <p>Vous recevrez un email lorsque votre colis sera livré.</p>
        <p>Merci pour votre confiance !</p>
      `;
    } else {
      emailSubject = 'Votre commande est prête';
      emailHtml = `
        <h2>Votre commande est prête à être retirée !</h2>
        <p>Bonjour ${customerName},</p>
        <p>Votre commande auprès de <strong>${cart.pharmacy.name}</strong> est maintenant prête.</p>
        <p>Vous pouvez venir la récupérer à l'adresse suivante:</p>
        <p>
          <strong>${cart.pharmacy.name}</strong><br>
          ${cart.pharmacy.address}<br>
          ${cart.pharmacy.city}<br>
          ${cart.pharmacy.phone ? `Tél: ${cart.pharmacy.phone}` : ''}
        </p>
        ${cart.pickup_message ? `<p><strong>Message de la pharmacie:</strong> ${cart.pickup_message}</p>` : ''}
        <p>Merci de vous munir d'une pièce d'identité lors du retrait.</p>
        <p>À bientôt !</p>
      `;
    }

    // Send email using Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Arthur Pharmacie <notifications@arthur-pharmacie.fr>',
        to: [customerEmail],
        subject: emailSubject,
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