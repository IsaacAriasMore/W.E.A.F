import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "npm:@supabase/supabase-js@2.110.8/cors"
import { withSupabase } from "@supabase/server"
import { approvalUrl, PayPalError, paypalRequest } from "../_shared/paypal.ts"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })
const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""))
const money = (minor: number) => (minor / 100).toFixed(2)

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (Number(req.headers.get("content-length") || 0) > 2048) return json({ error: "payload_too_large" }, 413)
  if (Deno.env.get("BILLING_ENABLED") !== "true" || Deno.env.get("PAYPAL_ENABLED") !== "true" || Deno.env.get("PAYPAL_MODE") !== "sandbox") return json({ error: "marketplace_payments_disabled" }, 503)
  const publicSite = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "") || ""
  if (!publicSite) return json({ error: "billing_not_configured" }, 503)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: "invalid_json" }, 400) }
  if (!isUuid(body.listing_id) || !isUuid(body.idempotency_key)) return json({ error: "invalid_marketplace_order" }, 400)
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id
  if (!userId) return json({ error: "authentication_required" }, 401)
  const { data: prepared, error: prepareError } = await ctx.supabaseAdmin.rpc("prepare_marketplace_paypal_order", {
    p_user_id: userId, p_listing_id: body.listing_id, p_idempotency_key: body.idempotency_key,
  })
  if (prepareError || !prepared) return json({ error: prepareError?.message?.includes("disabled") ? "marketplace_payments_disabled" : "marketplace_order_not_available" }, 409)
  try {
    if (prepared.paypal_order_id) {
      const existing = await paypalRequest<{ status?: string; links?: Array<{ rel?: string; href?: string }> }>(`/v2/checkout/orders/${encodeURIComponent(prepared.paypal_order_id)}`)
      const url = approvalUrl(existing.links)
      if (url) return json({ url, reused: true })
      return json({ error: existing.status === "COMPLETED" ? "marketplace_order_completed" : "marketplace_order_not_approvable" }, 409)
    }
    const created = await paypalRequest<{ id?: string; links?: Array<{ rel?: string; href?: string }> }>("/v2/checkout/orders", {
      method: "POST", requestId: String(prepared.idempotency_key), prefer: "return=representation",
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: String(prepared.payment_id), custom_id: String(prepared.custom_id),
          description: "W.E.A.F marketplace featured listing - 7 days",
          amount: { currency_code: String(prepared.currency), value: money(Number(prepared.amount_minor)) },
        }],
        payment_source: { paypal: { experience_context: {
          brand_name: "W.E.A.F", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING",
          return_url: `${publicSite}/marketplace/payment/success?payment_id=${encodeURIComponent(String(prepared.payment_id))}`,
          cancel_url: `${publicSite}/marketplace/payment/cancel?listing_id=${encodeURIComponent(String(body.listing_id))}`,
        } } },
      },
    })
    const url = approvalUrl(created.links)
    if (!created.id || !url) throw new PayPalError("paypal_approval_url_missing", 502)
    const { error: attachError } = await ctx.supabaseAdmin.rpc("attach_marketplace_paypal_order", { p_payment_id: prepared.payment_id, p_user_id: userId, p_paypal_order_id: created.id })
    if (attachError) throw new PayPalError("marketplace_order_reconciliation_failed", 500)
    return json({ url })
  } catch (error) {
    console.error("create_marketplace_paypal_order_failed", error instanceof PayPalError ? error.code : "unknown")
    return json({ error: error instanceof PayPalError ? error.code : "marketplace_order_failed" }, error instanceof PayPalError ? error.status : 502)
  }
})

export default { fetch: (req: Request) => req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : handler(req) }
