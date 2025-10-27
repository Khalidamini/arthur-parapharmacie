import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductData {
  name: string;
  brand: string;
  price: number;
  category: string;
  description?: string;
  image_url?: string;
  stock_quantity: number;
  is_available: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    const { pharmacy_id, products } = await req.json();

    if (!pharmacy_id || !products || !Array.isArray(products)) {
      throw new Error('Missing pharmacy_id or products array');
    }

    // Verify user has permission to manage this pharmacy
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('pharmacy_id', pharmacy_id)
      .single();

    if (!userRole) {
      throw new Error('User does not have permission to manage this pharmacy');
    }

    console.log(`Syncing ${products.length} products for pharmacy ${pharmacy_id}`);

    const syncResults = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    // Process each product
    for (const productData of products as ProductData[]) {
      try {
        // Check if product exists by name and brand
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('name', productData.name)
          .eq('brand', productData.brand)
          .maybeSingle();

        let productId: string;

        if (existingProduct) {
          // Update existing product
          const { data: updatedProduct, error: updateError } = await supabase
            .from('products')
            .update({
              price: productData.price,
              category: productData.category,
              description: productData.description,
              image_url: productData.image_url,
            })
            .eq('id', existingProduct.id)
            .select('id')
            .single();

          if (updateError) throw updateError;
          productId = updatedProduct.id;
        } else {
          // Create new product
          const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert({
              name: productData.name,
              brand: productData.brand,
              price: productData.price,
              category: productData.category,
              description: productData.description,
              image_url: productData.image_url,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
          productId = newProduct.id;
          syncResults.created++;
        }

        // Update or create pharmacy_product entry
        const { data: existingPharmacyProduct } = await supabase
          .from('pharmacy_products')
          .select('id')
          .eq('pharmacy_id', pharmacy_id)
          .eq('product_id', productId)
          .maybeSingle();

        if (existingPharmacyProduct) {
          // Update stock and availability
          await supabase
            .from('pharmacy_products')
            .update({
              stock_quantity: productData.stock_quantity,
              is_available: productData.is_available,
            })
            .eq('id', existingPharmacyProduct.id);
          
          if (!existingProduct) {
            syncResults.created++;
          } else {
            syncResults.updated++;
          }
        } else {
          // Create new pharmacy_product
          await supabase
            .from('pharmacy_products')
            .insert({
              pharmacy_id,
              product_id: productId,
              stock_quantity: productData.stock_quantity,
              is_available: productData.is_available,
            });
          
          syncResults.created++;
        }
      } catch (error) {
        console.error(`Error processing product ${productData.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        syncResults.errors.push(`${productData.name}: ${errorMessage}`);
      }
    }

    console.log('Sync complete:', syncResults);

    return new Response(
      JSON.stringify({
        success: true,
        results: syncResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-pharmacy-products:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
