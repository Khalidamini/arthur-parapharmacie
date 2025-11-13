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

    // Create Sendcloud shipment
    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_PUBLIC_KEY');
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_SECRET_KEY');
    
    if (!sendcloudPublicKey || !sendcloudSecretKey) {
      throw new Error("Sendcloud API keys not configured");
    }

    // Sendcloud uses Basic Auth with public:secret keys
    const authString = btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);

    const sendcloudPayload = {
      parcel: {
        name: cart.delivery_address.name || 'Client',
        address: cart.delivery_address.street,
        city: cart.delivery_address.city,
        postal_code: cart.delivery_address.postal_code,
        country: cart.delivery_address.country || 'FR',
        telephone: cart.delivery_address.phone || '',
        email: cart.notification_email || '',
        weight: (estimatedWeight / 1000).toFixed(3), // Convert to kg
        order_number: cartId,
        insured_value: cart.amount_total ? Math.round(Number(cart.amount_total)) : 0,
      },
      sender_address: {
        company_name: cart.pharmacy.name,
        address: cart.pharmacy.address,
        city: cart.pharmacy.city,
        postal_code: cart.pharmacy.postal_code,
        country: 'FR',
        telephone: cart.pharmacy.phone || '',
      },
      shipment: {
        id: 8, // Default to Colissimo (adjust based on your Sendcloud configuration)
      },
    };

    const sendcloudResponse = await fetch('https://panel.sendcloud.sc/api/v2/parcels', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendcloudPayload),
    });

    if (!sendcloudResponse.ok) {
      const errorText = await sendcloudResponse.text();
      console.error('Sendcloud API error:', errorText);
      throw new Error(`Failed to create shipment: ${errorText}`);
    }

    const shipmentData = await sendcloudResponse.json();

    // Update cart with tracking info
    const parcelData = shipmentData.parcel;
    await supabaseClient
      .from('carts')
      .update({
        shipping_tracking_number: parcelData.tracking_number,
        shipping_label_url: parcelData.label?.label_printer || parcelData.label?.normal_printer?.[0],
      })
      .eq('id', cartId);

    return new Response(
      JSON.stringify({
        success: true,
        tracking_number: parcelData.tracking_number,
        label_url: parcelData.label?.label_printer || parcelData.label?.normal_printer?.[0],
        parcel_id: parcelData.id,
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