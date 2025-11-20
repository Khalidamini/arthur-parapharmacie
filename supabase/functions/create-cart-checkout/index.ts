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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Use anon key to resolve the user from the JWT, and service role for DB queries
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAuth.auth.getUser(token);
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
      .select('id, user_id, pharmacy_id, amount_total, payment_intent_id, delivery_method, delivery_type, delivery_location_type, delivery_address, notification_email')
      .eq('id', cartId)
      .maybeSingle();

    if (cartError || !cart) {
      console.error('Cart error:', cartError);
      throw new Error(`Cart not found: ${cartError?.message || 'Unknown error'}`);
    }

    // Get pharmacy details if pharmacy_id exists
    let pharmacyAccount = null;
    if (cart.pharmacy_id) {
      const { data: pharmacy } = await supabaseClient
        .from('pharmacies')
        .select('name, stripe_account_id')
        .eq('id', cart.pharmacy_id)
        .single();
      
      pharmacyAccount = pharmacy?.stripe_account_id;
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
    const cartItemsTotal = items.reduce((sum, item) => 
      sum + (Number(item.price) * item.quantity), 0
    );
    
    // Calculate delivery fee based on delivery type and location
    let deliveryFee = 0;
    if (cart.delivery_method === 'delivery') {
      const isExpress = cart.delivery_type === 'express';
      const isHome = cart.delivery_location_type === 'home';
      
      if (isHome && isExpress) {
        deliveryFee = 12.90;
      } else if (isHome && !isExpress) {
        deliveryFee = 6.90;
      } else if (!isHome && isExpress) {
        deliveryFee = 9.90;
      } else {
        deliveryFee = 4.90;
      }
    }
    const totalAmount = cartItemsTotal + deliveryFee;

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

    // Add delivery fee as a line item if applicable
    if (deliveryFee > 0) {
      const isExpress = cart.delivery_type === 'express';
      const isHome = cart.delivery_location_type === 'home';
      
      let deliveryDescription = 'Livraison ';
      if (isExpress) {
        deliveryDescription += 'express ';
      } else {
        deliveryDescription += 'standard ';
      }
      deliveryDescription += isHome ? 'à domicile' : 'en point relais';
      deliveryDescription += ' via Sendcloud';
      
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Frais de livraison',
            description: deliveryDescription,
            images: [],
          },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

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
