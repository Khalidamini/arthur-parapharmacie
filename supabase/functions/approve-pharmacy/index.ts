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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const { data: adminRole, error: adminError } = await supabase
      .from('admin_roles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (adminError || !adminRole) {
      throw new Error('Unauthorized - Admin access required')
    }

    const { registrationId } = await req.json()

    if (!registrationId) {
      throw new Error('Registration ID is required')
    }

    // Get the registration details
    const { data: registration, error: regError } = await supabase
      .from('pharmacy_registrations')
      .select('*')
      .eq('id', registrationId)
      .single()

    if (regError || !registration) {
      throw new Error('Registration not found')
    }

    if (registration.status !== 'pending') {
      throw new Error('Registration is not pending')
    }

    // Find the user by email
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      throw new Error('Failed to find user')
    }

    const ownerUser = users.find(u => u.email === registration.owner_email)
    
    if (!ownerUser) {
      throw new Error('Owner user not found')
    }

    // Generate a unique QR code for the pharmacy
    const qrCode = `PH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Get coordinates using free Nominatim geocoding
    let latitude = 0
    let longitude = 0
    
    try {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?` + 
        `street=${encodeURIComponent(registration.address)}&` +
        `city=${encodeURIComponent(registration.city)}&` +
        `postalcode=${encodeURIComponent(registration.postal_code)}&` +
        `format=json&limit=1`
      
      const geocodeResponse = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'PharmacyApp/1.0'
        }
      })
      
      const geocodeData = await geocodeResponse.json()
      
      if (geocodeData && geocodeData.length > 0) {
        latitude = parseFloat(geocodeData[0].lat)
        longitude = parseFloat(geocodeData[0].lon)
        console.log('Geocoding successful:', { latitude, longitude })
      }
    } catch (geocodeError) {
      console.error('Geocoding error:', geocodeError)
      // Continue with default coordinates if geocoding fails
    }

    // Create the pharmacy
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from('pharmacies')
      .insert({
        name: registration.pharmacy_name,
        address: registration.address,
        city: registration.city,
        postal_code: registration.postal_code,
        phone: registration.phone,
        qr_code: qrCode,
        latitude,
        longitude,
      })
      .select()
      .single()

    if (pharmacyError) {
      console.error('Error creating pharmacy:', pharmacyError)
      throw new Error('Failed to create pharmacy')
    }

    // Create the owner role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: ownerUser.id,
        pharmacy_id: pharmacy.id,
        role: 'owner',
      })

    if (roleError) {
      console.error('Error creating owner role:', roleError)
      // Rollback: delete the pharmacy
      await supabase.from('pharmacies').delete().eq('id', pharmacy.id)
      throw new Error('Failed to assign owner role')
    }

    // Update registration status
    const { error: updateError } = await supabase
      .from('pharmacy_registrations')
      .update({ status: 'approved' })
      .eq('id', registrationId)

    if (updateError) {
      console.error('Error updating registration:', updateError)
      throw new Error('Failed to update registration status')
    }

    console.log('Pharmacy approved successfully:', {
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name,
      ownerId: ownerUser.id,
    })

    // Send approval email using Resend (same infrastructure as auth emails)
    const sendApprovalEmail = async () => {
      try {
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (!resendApiKey) {
          console.warn('RESEND_API_KEY not configured, skipping email')
          return
        }

        const appUrl = Deno.env.get('SUPABASE_URL')?.replace('gtjmebionytcomoldgjl.supabase.co', '3b72382b-3b57-45aa-a867-b6a8dda6f0e1.lovableproject.com') || 'https://3b72382b-3b57-45aa-a867-b6a8dda6f0e1.lovableproject.com'
        const dashboardUrl = `${appUrl}/pharmacy/dashboard`

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Pharmacie App <onboarding@resend.dev>',
            to: [registration.owner_email],
            subject: 'Votre pharmacie a été approuvée !',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #4F46E5;">Félicitations ${registration.owner_name} !</h1>
                <p>Votre demande d'inscription pour <strong>${registration.pharmacy_name}</strong> a été approuvée.</p>
                <p>Vous pouvez maintenant accéder à votre espace de gestion :</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Accéder à mon tableau de bord</a>
                </p>
                <p>Votre code QR unique : <strong>${qrCode}</strong></p>
                <p><strong>Coordonnées de votre pharmacie :</strong></p>
                <ul>
                  <li>Adresse : ${registration.address}</li>
                  <li>Ville : ${registration.postal_code} ${registration.city}</li>
                  ${registration.phone ? `<li>Téléphone : ${registration.phone}</li>` : ''}
                  <li>Localisation : ${latitude !== 0 && longitude !== 0 ? 'Géolocalisée ✓' : 'À définir'}</li>
                </ul>
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  Cordialement,<br>L'équipe Pharmacie App
                </p>
              </div>
            `,
          }),
        })

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text()
          console.error('Failed to send approval email:', errorText)
        } else {
          console.log('Approval email sent successfully to', registration.owner_email)
        }
      } catch (emailError) {
        console.error('Error sending approval email:', emailError)
      }
    }

    // Send email in background (ensure it completes even after response)
    try {
      // @ts-ignore EdgeRuntime is available in Edge Functions
      EdgeRuntime.waitUntil(sendApprovalEmail());
    } catch (_e) {
      // Fallback: fire-and-forget if waitUntil not available
      sendApprovalEmail();
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pharmacy,
        message: 'Pharmacy approved successfully'
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
  } catch (error: any) {
    console.error('Error in approve-pharmacy function:', error)
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
