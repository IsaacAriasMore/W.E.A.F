import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "@supabase/supabase-js/cors"
import { withSupabase } from "@supabase/server"
import Stripe from "stripe"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })
const paidPlans = new Set(["normal", "plus"])

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed", message: "Usa una petición POST." }, 405)
  if (Number(req.headers.get("content-length") || 0) > 2048) return json({ error: "payload_too_large" }, 413)
  if (Deno.env.get("BILLING_ENABLED") !== "true" || Deno.env.get("STRIPE_ENABLED") !== "true") {
    return json({ error: "billing_disabled", message: "La facturación está desactivada temporalmente." }, 503)
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
  const normalPrice = Deno.env.get("STRIPE_PRICE_SERVER_NORMAL_MONTHLY")
  const plusPrice = Deno.env.get("STRIPE_PRICE_SERVER_PLUS_MONTHLY")
  const publicSite = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "")
  if (!stripeKey || !normalPrice || !plusPrice || !publicSite) {
    return json({ error: "payments_not_configured", message: "Stripe aún no está configurado por completo." }, 503)
  }

  let serverListingId = ""
  let planType = ""
  try {
    const body = await req.json()
    serverListingId = String(body.server_listing_id || "")
    planType = String(body.plan_type || "")
  } catch {
    return json({ error: "invalid_json", message: "El cuerpo de la petición no es JSON válido." }, 400)
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(serverListingId)) {
    return json({ error: "invalid_server_listing_id", message: "El anuncio no es válido." }, 400)
  }
  if (!paidPlans.has(planType)) {
    return json({ error: "invalid_plan_type", message: "El plan debe ser normal o plus." }, 400)
  }

  const claims = ctx.userClaims as { sub?: string; id?: string; email?: string } | undefined
  const userId = claims?.sub || claims?.id
  if (!userId) return json({ error: "authentication_required", message: "Inicia sesión para continuar." }, 401)

  const { data: ownedListing, error: ownershipError } = await ctx.supabase
    .from("server_listings")
    .select("id,owner_user_id,stripe_checkout_session_id")
    .eq("id", serverListingId)
    .maybeSingle()
  if (ownershipError || !ownedListing || ownedListing.owner_user_id !== userId) {
    return json({ error: "listing_not_owned", message: "Solo puedes pagar publicaciones que te pertenecen." }, 403)
  }

  const { data: prepared, error: prepareError } = await ctx.supabaseAdmin.rpc("prepare_server_listing_checkout", {
    p_user_id: userId,
    p_listing_id: serverListingId,
    p_plan_type: planType,
  })
  if (prepareError || !prepared) {
    const code = prepareError?.message || "checkout_not_available"
    const status = code.includes("checkout_rate_limit") ? 429 : 403
    const message = code.includes("listing_already_active")
      ? "Esta publicación ya tiene una suscripción activa. Usa el portal de facturación."
      : code.includes("checkout_rate_limit")
        ? "Espera dos minutos antes de iniciar otro pago."
        : "No se puede iniciar el pago para esta publicación."
    return json({ error: code, message }, status)
  }

  const stripe = new Stripe(stripeKey)
  let customerId = String(prepared.stripe_customer_id || "")
  try {
    const previousSessionId = String(ownedListing.stripe_checkout_session_id || "")
    if (/^cs_(test_|live_)?[A-Za-z0-9]+/.test(previousSessionId)) {
      const previousSession = await stripe.checkout.sessions.retrieve(previousSessionId).catch(() => null)
      if (previousSession?.status === "open") {
        await stripe.checkout.sessions.expire(previousSessionId)
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: claims?.email,
        metadata: { user_id: userId },
      })
      customerId = customer.id
      const { error: customerError } = await ctx.supabaseAdmin
        .from("billing_customers")
        .upsert({ user_id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      if (customerError) throw new Error("billing_customer_reconciliation_failed")
    }

    const priceId = planType === "normal" ? normalPrice : plusPrice
    const metadata = { user_id: userId, server_listing_id: serverListingId, plan_type: planType }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: serverListingId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      success_url: `${publicSite}/servers/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicSite}/servers/cancel?listing_id=${encodeURIComponent(serverListingId)}`,
    })
    if (!session.url) throw new Error("stripe_checkout_url_missing")

    const { error: attachError } = await ctx.supabaseAdmin.rpc("attach_server_listing_checkout", {
      p_user_id: userId,
      p_listing_id: serverListingId,
      p_plan_type: planType,
      p_stripe_price_id: priceId,
      p_stripe_customer_id: customerId,
      p_session_id: session.id,
    })
    if (attachError) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
      throw new Error("checkout_reconciliation_failed")
    }
    return json({ url: session.url })
  } catch (error) {
    console.error("create_server_listing_checkout_failed", error instanceof Error ? error.message : "unknown")
    return json({ error: "stripe_checkout_failed", message: "No pudimos abrir Stripe. Inténtalo de nuevo." }, 502)
  }
})

export default {
  fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    return handler(req)
  },
}
