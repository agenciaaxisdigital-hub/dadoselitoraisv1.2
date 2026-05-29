import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-04-10' })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'stripe-signature, content-type' }

Deno.serve(async (req) => {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch (err: any) {
    return new Response(`Webhook error: ${err.message}`, { status: 400 })
  }

  const sub = event.data.object as Stripe.Subscription

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const customerId = sub.customer as string
    const userId = sub.metadata?.supabase_user_id

    // 1. Garante que tenant existe
    let tenantId: string
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (existingTenant) {
      tenantId = existingTenant.id
    } else {
      // Busca email do customer
      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
      const { data: newTenant } = await supabase
        .from('tenants')
        .insert({ name: customer.email ?? customerId, stripe_customer_id: customerId })
        .select('id')
        .single()
      tenantId = newTenant!.id
    }

    // 2. Associa user ao tenant
    if (userId) {
      await supabase
        .from('profiles')
        .update({ tenant_id: tenantId })
        .eq('id', userId)
    }

    // 3. Busca plan_id pelo stripe_price_id
    const priceId = sub.items.data[0]?.price?.id
    const { data: plan } = priceId
      ? await supabase.from('plans').select('id').eq('stripe_price_id', priceId).single()
      : { data: null }

    // 4. Upsert subscription
    await supabase.from('subscriptions').upsert({
      tenant_id: tenantId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      plan_id: plan?.id ?? null,
      status: sub.status,
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_subscription_id' })
  }

  if (event.type === 'customer.subscription.deleted') {
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
