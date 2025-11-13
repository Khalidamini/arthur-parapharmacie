import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeliveryStatus {
  id: number;
  message: string;
  timestamp: string;
}

interface SendcloudParcel {
  id: number;
  tracking_number: string;
  status: {
    id: number;
    message: string;
  };
  shipment: {
    name: string;
  };
  statusses: DeliveryStatus[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const sendcloudPublicKey = Deno.env.get('SENDCLOUD_PUBLIC_KEY');
    const sendcloudSecretKey = Deno.env.get('SENDCLOUD_SECRET_KEY');

    if (!sendcloudPublicKey || !sendcloudSecretKey) {
      throw new Error("Sendcloud API keys not configured");
    }

    const authString = btoa(`${sendcloudPublicKey}:${sendcloudSecretKey}`);

    // Récupérer toutes les commandes avec livraison en cours
    const { data: deliveryOrders, error: ordersError } = await supabaseClient
      .from('carts')
      .select('id, user_id, shipping_tracking_number, delivery_status, notification_email')
      .eq('delivery_method', 'delivery')
      .eq('payment_status', 'paid')
      .not('shipping_tracking_number', 'is', null)
      .neq('delivery_status', 'delivered');

    if (ordersError) {
      console.error('Error fetching delivery orders:', ordersError);
      throw ordersError;
    }

    console.log(`Checking status for ${deliveryOrders?.length || 0} deliveries`);

    const updates = [];

    // Pour chaque commande avec livraison
    for (const order of deliveryOrders || []) {
      try {
        // Interroger l'API Sendcloud
        const sendcloudResponse = await fetch(
          `https://panel.sendcloud.sc/api/v2/parcels?tracking_number=${order.shipping_tracking_number}`,
          {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!sendcloudResponse.ok) {
          console.error(`Sendcloud API error for tracking ${order.shipping_tracking_number}:`, await sendcloudResponse.text());
          continue;
        }

        const data = await sendcloudResponse.json();
        const parcels: SendcloudParcel[] = data.parcels || [];

        if (parcels.length === 0) {
          console.log(`No parcel found for tracking ${order.shipping_tracking_number}`);
          continue;
        }

        const parcel = parcels[0];
        const currentStatus = parcel.status.message;
        const statusId = parcel.status.id;

        // Vérifier si le statut a changé
        if (currentStatus !== order.delivery_status) {
          console.log(`Status changed for order ${order.id}: ${order.delivery_status} -> ${currentStatus}`);

          // Mettre à jour le statut en base
          const { error: updateError } = await supabaseClient
            .from('carts')
            .update({ 
              delivery_status: currentStatus,
              delivery_status_id: statusId
            })
            .eq('id', order.id);

          if (updateError) {
            console.error('Error updating delivery status:', updateError);
            continue;
          }

          // Récupérer les infos du client
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', order.user_id)
            .single();

          const customerEmail = order.notification_email || profile?.email;
          
          if (customerEmail) {
            try {
              // Utiliser le service d'email existant
              await supabaseClient.functions.invoke('send-email', {
                body: {
                  to: customerEmail,
                  subject: `📦 Mise à jour de votre livraison`,
                  html: `
                    <h2>Mise à jour de votre livraison</h2>
                    <p>Bonjour ${profile?.first_name || 'Client'},</p>
                    <p>Nous vous informons que le statut de votre livraison a été mis à jour :</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 18px; font-weight: bold; color: #2563eb;">
                        ${currentStatus}
                      </p>
                    </div>
                    <p><strong>Numéro de suivi :</strong> ${order.shipping_tracking_number}</p>
                    <p>
                      <a href="https://panel.sendcloud.sc/track-trace/?tracking_number=${order.shipping_tracking_number}" 
                         style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                        Suivre ma livraison
                      </a>
                    </p>
                    ${statusId === 11 ? '<p style="color: #16a34a; font-weight: bold;">✓ Votre colis a été livré !</p>' : ''}
                    <p style="color: #6b7280; margin-top: 30px;">
                      Cette notification est automatique, merci de ne pas y répondre.
                    </p>
                  `,
                }
              });

              console.log(`Notification sent to ${customerEmail} for order ${order.id}`);
            } catch (emailError) {
              console.error('Error sending email notification:', emailError);
              // Ne pas bloquer le processus si l'email échoue
            }
          }

          updates.push({
            orderId: order.id,
            oldStatus: order.delivery_status,
            newStatus: currentStatus,
            notified: !!customerEmail
          });
        }
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
        continue;
      }
    }

    console.log(`Processed ${deliveryOrders?.length || 0} orders, ${updates.length} status updates`);

    return new Response(
      JSON.stringify({
        success: true,
        checked: deliveryOrders?.length || 0,
        updates: updates.length,
        details: updates
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error checking delivery status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
