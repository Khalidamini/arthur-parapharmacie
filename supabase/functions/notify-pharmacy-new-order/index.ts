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
    const customerName = profile?.username || customerEmail;
    const deliveryMethod = cart.delivery_method === 'delivery' ? 'Livraison à domicile' : 'Retrait en pharmacie';

    // Prepare email content
    const itemsList = items.map(item => 
      `- ${item.product_name} (${item.brand}) x${item.quantity} - ${Number(item.price).toFixed(2)}€`
    ).join('\n');

    const totalAmount = items.reduce((sum, item) => 
      sum + (Number(item.price) * item.quantity), 0
    );

    const emailHtml = `
      <h2>Nouvelle commande reçue</h2>
      <p><strong>Client:</strong> ${customerName}</p>
      <p><strong>Email de contact:</strong> ${customerEmail}</p>
      <p><strong>Mode de récupération:</strong> ${deliveryMethod}</p>
      
      <h3>Produits commandés:</h3>
      <pre>${itemsList}</pre>
      
      <p><strong>Montant total:</strong> ${totalAmount.toFixed(2)}€</p>
      <p><strong>Statut du paiement:</strong> ${cart.payment_status === 'paid' ? 'Payé' : 'En attente'}</p>
      
      ${cart.delivery_address ? `
        <h3>Adresse de livraison:</h3>
        <p>
          ${cart.delivery_address.street}<br>
          ${cart.delivery_address.postal_code} ${cart.delivery_address.city}<br>
          ${cart.delivery_address.country || 'France'}
        </p>
      ` : ''}
      
      <p>Connectez-vous à votre tableau de bord pour gérer cette commande.</p>
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
        
        // Send email notification using Resend
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Arthur Pharmacie <onboarding@resend.dev>',
            to: pharmacyEmails,
            subject: `Nouvelle commande - ${customerName}`,
            html: emailHtml,
          }),
        });

        if (!resendResponse.ok) {
          console.error('Failed to send pharmacy notification:', await resendResponse.text());
        }
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