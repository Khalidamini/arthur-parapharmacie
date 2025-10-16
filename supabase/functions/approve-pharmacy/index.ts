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
        latitude: 0, // Default values - should be updated later
        longitude: 0,
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
