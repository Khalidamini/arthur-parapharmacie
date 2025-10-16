import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'https://esm.sh/resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400, headers: corsHeaders })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)
  try {
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: { email: string }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const confirmationLink = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
            h1 { color: #333; font-size: 24px; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; margin-bottom: 15px; }
            .button { display: inline-block; background-color: #2754C5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .code { background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace; color: #333; margin: 15px 0; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Confirmez votre email</h1>
            <p>Merci de vous être inscrit ! Cliquez sur le bouton ci-dessous pour confirmer votre adresse email :</p>
            <a href="${confirmationLink}" class="button">Confirmer mon email</a>
            <p>Ou copiez et collez ce code de confirmation temporaire :</p>
            <div class="code">${token}</div>
            <p class="footer">Si vous n'avez pas demandé cette confirmation, vous pouvez ignorer cet email en toute sécurité.</p>
          </div>
        </body>
      </html>
    `

    const { error } = await resend.emails.send({
      from: 'Arthur <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Confirmez votre email',
      html,
    })
    if (error) throw error
  } catch (error: any) {
    console.log(error)
    return new Response(
      JSON.stringify({ error: { message: error.message } }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
})
