import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-04-10' })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { user_id, email } = await req.json()
    if (!user_id || !email) return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: CORS })

    // Busca ou cria customer no Stripe
    let customerId: string
    const existing = await stripe.customers.list({ email, limit: 1 })
    if (existing.data.length > 0) {
      customerId = existing.data[0].id
    } else {
      const customer = await stripe.customers.create({ email, metadata: { supabase_user_id: user_id } })
      customerId = customer.id
    }

    // Busca price_id do plano ativo
    const { data: plan } = await supabase
      .from('plans')
      .select('stripe_price_id')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!plan?.stripe_price_id) {
      return new Response(JSON.stringify({ error: 'No active plan found' }), { status: 500, headers: CORS })
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=canceled`,
      metadata: { supabase_user_id: user_id },
      payment_method_options: {
        card: { installments: { enabled: false } },
      },
      locale: 'pt-BR',
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS })
  }
})
