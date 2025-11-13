import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

const getFrontendUrl = (req: Request) => {
  return req.headers.get('origin') || Deno.env.get('SITE_URL') || (Deno.env.get('SUPABASE_URL')?.replace('/rest/v1','')) || '';
};

async function generateUniqueQr(supabaseClient: any): Promise<string> {
  const rand = () => String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  let code = rand();
  for (let i = 0; i < 5; i++) {
    const { data } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('qr_code_number', code)
      .maybeSingle();
    if (!data) return code;
    code = rand();
  }
  return rand();
}

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

    // Créer ou récupérer le compte utilisateur
    let newUserId: string | null = null;
    let userAlreadyExists = false;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (createError) {
      // Si l'utilisateur existe déjà, on rattache simplement le rôle
      if ((createError as any).code === 'email_exists' || (createError as any).message?.includes('already been registered')) {
        userAlreadyExists = true;
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const found = users?.users.find(u => u.email === email);
        if (!found) {
          return new Response(
            JSON.stringify({ error: 'Utilisateur déjà existant mais introuvable' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
          );
        }
        newUserId = found.id;
      } else {
        console.error('Erreur création utilisateur:', createError);
        return new Response(
          JSON.stringify({ error: (createError as any).message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } else {
      newUserId = created!.user.id;
    }

    // Créer le profil si inexistant (avec QR obligatoire)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', newUserId)
      .maybeSingle();
    if (!existingProfile) {
      try {
        const qr = await generateUniqueQr(supabaseAdmin);
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({ id: newUserId, email, qr_code_number: qr });
        if (profileError) {
          console.error('Erreur création profil:', profileError);
        }
      } catch (e) {
        console.error('Erreur génération QR:', e);
      }
    }

    // Attribuer le rôle (vérifier si déjà existant)
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', newUserId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle();

    let roleError = null;
    if (existingRole) {
      // Mettre à jour le rôle existant
      const { error } = await supabaseAdmin
        .from('user_roles')
        .update({
          role,
          must_change_password: !userAlreadyExists,
          temporary_password_set_at: !userAlreadyExists ? new Date().toISOString() : null,
        })
        .eq('id', existingRole.id);
      roleError = error;
    } else {
      // Créer un nouveau rôle
      const { error } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUserId,
          pharmacy_id: pharmacyId,
          role,
          must_change_password: !userAlreadyExists,
          temporary_password_set_at: !userAlreadyExists ? new Date().toISOString() : null,
        });
      roleError = error;
    }

    if (roleError) {
      console.error('Erreur création rôle:', roleError);
      // Supprimer l'utilisateur si on vient de le créer
      if (!userAlreadyExists && newUserId) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
      }
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

    // 6. Envoyer l'email d'invitation via SMTP
    let emailSent = true;
    let emailErrorMessage: string | null = null;
    
    try {
      const client = new SMTPClient({
        connection: {
          hostname: Deno.env.get('SMTP_HOST') || 'smtp.ionos.fr',
          port: parseInt(Deno.env.get('SMTP_PORT') || '465'),
          tls: true,
          auth: {
            username: Deno.env.get('SMTP_USER') || '',
            password: Deno.env.get('SMTP_PASSWORD') || '',
          },
        },
      });

      const loginUrl = `${getFrontendUrl(req)}/pharmacy-login`;

      await client.send({
        from: 'contact@gptprive.com',
        to: email,
        subject: `Invitation à rejoindre ${pharmacy?.name || 'une pharmacie'} sur Arthur`,
        content: 'auto',
        html: `
          <h1>Bienvenue sur Arthur</h1>
          <p>Vous avez été invité à rejoindre l'équipe de <strong>${pharmacy?.name || 'une pharmacie'}</strong>.</p>
          <p>Voici vos identifiants de connexion :</p>
          <ul>
            <li><strong>Email :</strong> ${email}</li>
            ${!userAlreadyExists ? `<li><strong>Mot de passe provisoire :</strong> ${temporaryPassword}</li>` : ''}
          </ul>
          ${!userAlreadyExists ? '<p><strong>Important :</strong> Vous devrez changer ce mot de passe lors de votre première connexion.</p>' : ''}
          <p><a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">Se connecter maintenant</a></p>
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.</p>
        `,
      });

      await client.close();
      console.log('Email envoyé avec succès via SMTP');
    } catch (error: any) {
      emailSent = false;
      emailErrorMessage = error.message || 'Erreur lors de l\'envoi de l\'email';
      console.error('Erreur envoi email SMTP:', error);
    }

    console.log('Résultat invitation:', {
      email,
      role,
      pharmacyId,
      userCreated: !userAlreadyExists,
      emailSent,
      emailErrorMessage,
    });

    return new Response(
      JSON.stringify({
        message: `Invitation envoyée à ${email}`,
        temporaryPassword: userAlreadyExists ? null : temporaryPassword,
        emailSent,
        emailErrorMessage,
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
