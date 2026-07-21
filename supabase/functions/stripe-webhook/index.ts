import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import Stripe from "stripe"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "content-type": "application/json" } })
const idOf = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id || ""
const period = (subscription: Stripe.Subscription) => {
  const item = subscription.items.data[0]
  const legacy = subscription as unknown as { current_period_start?: number; current_period_end?: number }
  return { start: item?.current_period_start || legacy.current_period_start || subscription.created, end: item?.current_period_end || legacy.current_period_end || 0 }
}

const handler = withSupabase({ auth: "none" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  if (!stripeKey || !webhookSecret) return json({ error: "payments_not_configured" }, 503)
  const signature = req.headers.get("stripe-signature")
  if (!signature) return json({ error: "missing_stripe_signature" }, 400)
  const rawBody = await req.text()
  if (rawBody.length > 1024 * 1024) return json({ error: "payload_too_large" }, 413)

  const stripe = new Stripe(stripeKey)
  let event: Stripe.Event
  try { event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret) }
  catch { return json({ error: "invalid_stripe_signature" }, 400) }

  let data: Record<string, unknown> = {}
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const subscription = await stripe.subscriptions.retrieve(idOf(session.subscription))
      const dates = period(subscription)
      data = { payment_id: session.metadata?.payment_id, user_id: session.metadata?.user_id, plan_code: session.metadata?.plan_code, session_id: session.id, customer_id: idOf(session.customer), subscription_id: subscription.id, subscription_status: subscription.status, payment_status: session.payment_status, payment_intent_id: idOf(session.payment_intent), amount_total: session.amount_total, current_period_start: dates.start, current_period_end: dates.end, cancel_at_period_end: subscription.cancel_at_period_end }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice
      const legacy = invoice as unknown as { subscription?: string; payment_intent?: string }
      const modern = invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }
      const subscription = await stripe.subscriptions.retrieve(idOf(legacy.subscription) || idOf(modern.parent?.subscription_details?.subscription))
      data = { subscription_id: subscription.id, invoice_id: invoice.id, payment_intent_id: idOf(legacy.payment_intent), amount_paid: invoice.amount_paid, current_period_end: period(subscription).end }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription
      data = { subscription_id: subscription.id, subscription_status: subscription.status, current_period_end: period(subscription).end, cancel_at_period_end: subscription.cancel_at_period_end }
    }

    const { data: processed, error } = await ctx.supabaseAdmin.rpc("process_stripe_server_event", { p_event_id: event.id, p_event_type: event.type, p_data: data })
    if (error) { console.error("stripe_event_reconciliation_failed", event.id, event.type); return json({ error: "stripe_event_reconciliation_failed" }, 500) }
    return json({ received: true, processed: Boolean(processed) })
  } catch (error) {
    console.error("stripe_event_processing_failed", event.id, error instanceof Error ? error.name : "unknown")
    return json({ error: "stripe_event_processing_failed" }, 500)
  }
})

export default { fetch: (req: Request) => handler(req) }
