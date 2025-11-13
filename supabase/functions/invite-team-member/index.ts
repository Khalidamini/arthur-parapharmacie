import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationRequest {
  email: string;
  role: string;
  pharmacyId: string;
}

const generateTemporaryPassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Authentifier l'utilisateur
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { email, role, pharmacyId }: InvitationRequest = await req.json();

    // Valider l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Email invalide' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Vérifier les permissions (owner ou admin)
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle();

    if (!userRole || (userRole.role !== 'owner' && userRole.role !== 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Permissions insuffisantes' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Vérifier si l'email existe déjà dans l'équipe
    const { data: existingMember } = await supabaseClient
      .from('user_roles')
      .select('id, user_id')
      .eq('pharmacy_id', pharmacyId)
      .limit(1)
      .maybeSingle();

    if (existingMember) {
      // Vérifier si cet utilisateur a déjà cet email
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const userWithEmail = users?.users.find(u => 
        u.email === email && u.id === existingMember.user_id
      );
      
      if (userWithEmail) {
        return new Response(
          JSON.stringify({ error: 'Cet email est déjà membre de cette pharmacie' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // Générer un mot de passe provisoire
    const temporaryPassword = generateTemporaryPassword();

    // Créer le compte utilisateur
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (createError) {
      console.error('Erreur création utilisateur:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Créer le profil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email: email,
      });

    if (profileError) {
      console.error('Erreur création profil:', profileError);
    }

    // Créer le rôle avec flag must_change_password
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        pharmacy_id: pharmacyId,
        role: role,
        must_change_password: true,
        temporary_password_set_at: new Date().toISOString(),
      });

    if (roleError) {
      console.error('Erreur création rôle:', roleError);
      // Supprimer l'utilisateur si le rôle n'a pas pu être créé
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Impossible de créer le rôle' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Récupérer le nom de la pharmacie
    const { data: pharmacy } = await supabaseClient
      .from('pharmacies')
      .select('name')
      .eq('id', pharmacyId)
      .single();

    // Envoyer l'email d'invitation via l'edge function send-email
    const emailContent = `
      <h2>Invitation à rejoindre ${pharmacy?.name || 'la pharmacie'}</h2>
      <p>Vous avez été invité(e) à rejoindre l'équipe en tant que <strong>${role}</strong>.</p>
      <p><strong>Vos identifiants de connexion :</strong></p>
      <ul>
        <li>Email : ${email}</li>
        <li>Mot de passe provisoire : ${temporaryPassword}</li>
      </ul>
      <p>⚠️ Vous devrez changer ce mot de passe lors de votre première connexion.</p>
      <p>Connectez-vous sur : ${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/pharmacy-login</p>
    `;

    const { error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
      body: {
        to: email,
        subject: `Invitation à rejoindre ${pharmacy?.name || 'la pharmacie'}`,
        html: emailContent,
      }
    });

    if (emailError) {
      console.error('Erreur envoi email:', emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Invitation envoyée à ${email}`,
        temporaryPassword: temporaryPassword // Pour copier dans le clipboard
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};

serve(handler);
