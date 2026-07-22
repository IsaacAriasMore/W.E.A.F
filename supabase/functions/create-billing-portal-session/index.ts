import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "@supabase/supabase-js/cors"
import { withSupabase } from "@supabase/server"
import Stripe from "stripe"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed", message: "Usa una petición POST." }, 405)
  if (Deno.env.get("BILLING_ENABLED") !== "true" || Deno.env.get("STRIPE_ENABLED") !== "true") {
    return json({ error: "billing_disabled", message: "La facturación está desactivada temporalmente." }, 503)
  }
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
  const publicSite = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "")
  if (!stripeKey || !publicSite) return json({ error: "payments_not_configured", message: "Stripe aún no está configurado." }, 503)

  const claims = ctx.userClaims as { sub?: string; id?: string } | undefined
  const userId = claims?.sub || claims?.id
  if (!userId) return json({ error: "authentication_required", message: "Inicia sesión para continuar." }, 401)

  const { data: billingCustomer } = await ctx.supabaseAdmin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle()
  let customerId = billingCustomer?.stripe_customer_id || ""
  if (!customerId) {
    const { data: listing } = await ctx.supabaseAdmin
      .from("server_listings")
      .select("stripe_customer_id")
      .eq("owner_user_id", userId)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .maybeSingle()
    customerId = listing?.stripe_customer_id || ""
  }
  if (!customerId) {
    return json({ error: "billing_customer_not_found", message: "Todavía no tienes una cuenta de facturación en Stripe." }, 404)
  }

  try {
    const stripe = new Stripe(stripeKey)
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${publicSite}/account/billing`,
    })
    return json({ url: session.url })
  } catch (error) {
    console.error("create_billing_portal_session_failed", error instanceof Error ? error.name : "unknown")
    return json({ error: "billing_portal_failed", message: "No pudimos abrir el portal de facturación." }, 502)
  }
})

export default {
  fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    return handler(req)
  },
}
