import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { registrationId } = await req.json()

    if (!registrationId) {
      throw new Error('Registration ID is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get registration details
    const { data: registration, error: regError } = await supabase
      .from('pharmacy_registrations')
      .select('*')
      .eq('id', registrationId)
      .single()

    if (regError || !registration) {
      throw new Error('Registration not found')
    }

    // Send notification email to admin
    const sendNotificationEmail = async () => {
      try {
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (!resendApiKey) {
          console.warn('RESEND_API_KEY not configured, skipping email')
          return
        }

        const appUrl = Deno.env.get('SUPABASE_URL')?.replace('gtjmebionytcomoldgjl.supabase.co', '3b72382b-3b57-45aa-a867-b6a8dda6f0e1.lovableproject.com') || 'https://3b72382b-3b57-45aa-a867-b6a8dda6f0e1.lovableproject.com'
        const adminUrl = `${appUrl}/admin/pharmacies`

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Pharmacie App <onboarding@resend.dev>',
            to: ['aminikhalid@gmail.com'],
            subject: '🔔 Nouvelle inscription de pharmacie',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #4F46E5;">📋 Nouvelle demande d'inscription</h1>
                <p>Une nouvelle pharmacie souhaite rejoindre le réseau Arthur.</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h2 style="color: #1f2937; margin-top: 0;">Informations de la pharmacie</h2>
                  <ul style="list-style: none; padding: 0;">
                    <li style="margin: 10px 0;"><strong>Nom :</strong> ${registration.pharmacy_name}</li>
                    <li style="margin: 10px 0;"><strong>Adresse :</strong> ${registration.address}</li>
                    <li style="margin: 10px 0;"><strong>Ville :</strong> ${registration.postal_code} ${registration.city}</li>
                    ${registration.phone ? `<li style="margin: 10px 0;"><strong>Téléphone :</strong> ${registration.phone}</li>` : ''}
                  </ul>
                  
                  <h2 style="color: #1f2937; margin-top: 20px;">Propriétaire</h2>
                  <ul style="list-style: none; padding: 0;">
                    <li style="margin: 10px 0;"><strong>Nom :</strong> ${registration.owner_name}</li>
                    <li style="margin: 10px 0;"><strong>Email :</strong> ${registration.owner_email}</li>
                  </ul>
                  
                  <p style="margin-top: 20px;"><strong>Date de la demande :</strong> ${new Date(registration.created_at).toLocaleString('fr-FR')}</p>
                </div>
                
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${adminUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Accéder au panneau d'administration</a>
                </p>
                
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  Cette notification automatique vous permet de traiter rapidement les nouvelles demandes d'inscription.
                </p>
              </div>
            `,
          }),
        })

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text()
          console.error('Failed to send notification email:', errorText)
        } else {
          console.log('Notification email sent successfully to admin')
        }
      } catch (emailError) {
        console.error('Error sending notification email:', emailError)
      }
    }

    // Send email in background
    sendNotificationEmail()

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin notification sent'
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
  } catch (error: any) {
    console.error('Error in notify-admin-new-registration function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred',
        success: false
      }),
      { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
  }
})
