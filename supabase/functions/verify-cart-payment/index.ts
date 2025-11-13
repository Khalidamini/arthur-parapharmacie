import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      const cartId = session.metadata?.cart_id;
      
      if (!cartId) {
        throw new Error("Cart ID not found in session metadata");
      }

      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Get cart details to check delivery method
      const { data: cart } = await supabaseClient
        .from('carts')
        .select('delivery_method')
        .eq('id', cartId)
        .single();

      // Update cart status to completed and paid
      await supabaseClient
        .from('carts')
        .update({
          status: 'completed',
          payment_status: 'paid',
          completed_at: new Date().toISOString(),
        })
        .eq('id', cartId);

      // Generate shipping label for delivery orders
      if (cart?.delivery_method === 'delivery') {
        console.log('Generating shipping label for delivery order:', cartId);
        try {
          await supabaseClient.functions.invoke('create-shipping-label', {
            body: { cartId }
          });
          console.log('Shipping label generated successfully');
        } catch (labelError) {
          console.error('Failed to generate shipping label:', labelError);
          // Don't fail the payment if label generation fails
        }
      }

      // Notify pharmacy about new paid order
      try {
        await supabaseClient.functions.invoke('notify-pharmacy-new-order', {
          body: { cartId }
        });
        console.log('Pharmacy notified successfully');
      } catch (notifyError) {
        console.error('Failed to notify pharmacy:', notifyError);
        // Don't fail the whole request if notification fails
      }

      // Notify customer about order confirmation
      try {
        await supabaseClient.functions.invoke('notify-customer-order-confirmation', {
          body: { cartId }
        });
        console.log('Customer notified successfully');
      } catch (notifyError) {
        console.error('Failed to notify customer:', notifyError);
        // Don't fail the whole request if notification fails
      }

      return new Response(
        JSON.stringify({ success: true, cartId }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Payment not completed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
