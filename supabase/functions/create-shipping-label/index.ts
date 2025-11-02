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
        pharmacy:pharmacies(name, address, city, postal_code, phone)
      `)
      .eq('id', cartId)
      .single();

    if (cartError || !cart) {
      throw new Error("Cart not found");
    }

    if (cart.delivery_method !== 'delivery') {
      throw new Error("This cart is not a delivery order");
    }

    if (!cart.delivery_address) {
      throw new Error("No delivery address provided");
    }

    // Get cart items for weight calculation
    const { data: items } = await supabaseClient
      .from('cart_items')
      .select('quantity')
      .eq('cart_id', cartId);

    // Estimate weight (500g per item on average)
    const totalItems = items?.reduce((sum, item) => sum + item.quantity, 0) || 1;
    const estimatedWeight = totalItems * 500; // grams

    // Create Shipy shipment
    const shipyApiKey = Deno.env.get('SHIPY_API_KEY');
    
    if (!shipyApiKey) {
      throw new Error("Shipy API key not configured");
    }

    const shipyPayload = {
      from: {
        company: cart.pharmacy.name,
        address: cart.pharmacy.address,
        city: cart.pharmacy.city,
        postal_code: cart.pharmacy.postal_code,
        country: 'FR',
        phone: cart.pharmacy.phone || '',
      },
      to: {
        name: cart.delivery_address.name || 'Client',
        address: cart.delivery_address.street,
        city: cart.delivery_address.city,
        postal_code: cart.delivery_address.postal_code,
        country: cart.delivery_address.country || 'FR',
        phone: cart.delivery_address.phone || '',
        email: cart.notification_email || '',
      },
      parcel: {
        weight: estimatedWeight,
        length: 30,
        width: 20,
        height: 10,
      },
      service: 'colissimo_domicile', // Default to Colissimo home delivery
      insurance: cart.amount_total ? Math.round(Number(cart.amount_total)) : 0,
      reference: cartId,
    };

    const shipyResponse = await fetch('https://api.shipy.pro/v1/shipments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${shipyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shipyPayload),
    });

    if (!shipyResponse.ok) {
      const errorText = await shipyResponse.text();
      console.error('Shipy API error:', errorText);
      throw new Error(`Failed to create shipment: ${errorText}`);
    }

    const shipmentData = await shipyResponse.json();

    // Update cart with tracking info
    await supabaseClient
      .from('carts')
      .update({
        shipping_tracking_number: shipmentData.tracking_number,
        shipping_label_url: shipmentData.label_url,
      })
      .eq('id', cartId);

    return new Response(
      JSON.stringify({
        success: true,
        tracking_number: shipmentData.tracking_number,
        label_url: shipmentData.label_url,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating shipping label:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});