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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    // Get request body
    const { cartId } = await req.json();
    
    if (!cartId) {
      throw new Error("Cart ID is required");
    }

    // Get cart details
    const { data: cart, error: cartError } = await supabaseClient
      .from('carts')
      .select(`
        *,
        pharmacies (
          name,
          stripe_account_id
        )
      `)
      .eq('id', cartId)
      .eq('user_id', user.id)
      .single();

    if (cartError || !cart) {
      throw new Error("Cart not found");
    }

    // Get cart items
    const { data: items, error: itemsError } = await supabaseClient
      .from('cart_items')
      .select('*')
      .eq('cart_id', cartId);

    if (itemsError || !items || items.length === 0) {
      throw new Error("No items in cart");
    }

    // Calculate total
    const totalAmount = items.reduce((sum, item) => 
      sum + (Number(item.price) * item.quantity), 0
    );

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ 
      email: user.email, 
      limit: 1 
    });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Prepare line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.product_name,
          description: `${item.brand} - ${item.source}`,
          images: item.image_url ? [item.image_url] : [],
        },
        unit_amount: Math.round(Number(item.price) * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    const pharmacyAccount = (cart.pharmacies as any)?.stripe_account_id;
    
    // Create checkout session
    const sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/cart`,
      metadata: {
        cart_id: cartId,
        user_id: user.id,
      },
    };

    // If pharmacy has Stripe Connect account, add transfer
    if (pharmacyAccount) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: Math.round(totalAmount * 100 * 0.05), // 5% platform fee
        transfer_data: {
          destination: pharmacyAccount,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Update cart with payment intent
    await supabaseClient
      .from('carts')
      .update({
        payment_intent_id: session.payment_intent,
        amount_total: totalAmount,
      })
      .eq('id', cartId);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
