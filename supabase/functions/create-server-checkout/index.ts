import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "@supabase/supabase-js/cors"
import { withSupabase } from "@supabase/server"
import Stripe from "stripe"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })
const allowedPlans = new Set(["normal", "plus"])

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (Number(req.headers.get("content-length") || 0) > 1024) return json({ error: "payload_too_large" }, 413)
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
  const publicSite = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "")
  if (!stripeKey || !publicSite) return json({ error: "payments_not_configured" }, 503)

  let requestedPlan: string
  try { requestedPlan = (await req.json()).planCode } catch { return json({ error: "invalid_json" }, 400) }
  if (!allowedPlans.has(requestedPlan)) return json({ error: "plan_not_available" }, 400)
  const claims = ctx.userClaims as { sub?: string; id?: string; email?: string } | undefined
  const userId = claims?.sub || claims?.id
  if (!userId) return json({ error: "authentication_required" }, 401)

  const { data: prepared, error: prepareError } = await ctx.supabaseAdmin.rpc("prepare_server_checkout", { p_user_id: userId, p_plan_code: requestedPlan })
  if (prepareError || !prepared) {
    const limited = prepareError?.message?.includes("checkout_rate_limit")
    return json({ error: limited ? "checkout_rate_limit" : "checkout_not_available" }, limited ? 429 : 403)
  }

  const stripe = new Stripe(stripeKey)
  try {
    const metadata = { payment_id: prepared.payment_id, user_id: userId, plan_code: prepared.plan_code }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: userId,
      customer_email: claims?.email,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: prepared.amount_usd_cents, recurring: { interval: "month" }, product_data: { name: `W.E.A.F Servidores - ${prepared.plan_name}` } } }],
      metadata,
      subscription_data: { metadata },
      success_url: `${publicSite}/servers/publish?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicSite}/servers/owners?checkout=canceled`,
    })
    const { error: attachError } = await ctx.supabaseAdmin.rpc("attach_stripe_checkout_session", { p_payment_id: prepared.payment_id, p_user_id: userId, p_session_id: session.id })
    if (attachError) return json({ error: "checkout_reconciliation_failed" }, 500)
    return json({ checkoutUrl: session.url })
  } catch (error) {
    console.error("stripe_checkout_failed", error instanceof Error ? error.name : "unknown")
    return json({ error: "stripe_checkout_failed" }, 502)
  }
})

export default { fetch(req: Request) { if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders }); return handler(req) } }
