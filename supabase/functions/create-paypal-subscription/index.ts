import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "@supabase/supabase-js/cors"
import { withSupabase } from "@supabase/server"
import { approvalUrl, PayPalError, paypalRequest } from "../_shared/paypal.ts"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })
const isUuid = (value: unknown) => /^[0-9a-f-]{36}$/i.test(String(value || ""))

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (Number(req.headers.get("content-length") || 0) > 4096) return json({ error: "payload_too_large" }, 413)
  if (Deno.env.get("BILLING_ENABLED") !== "true" || Deno.env.get("PAYPAL_ENABLED") !== "true" || Deno.env.get("PAYPAL_MODE") !== "sandbox") return json({ error: "billing_disabled" }, 503)
  const publicSite = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "") || ""
  if (!publicSite) return json({ error: "billing_not_configured" }, 503)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: "invalid_json" }, 400) }
  if (!isUuid(body.server_listing_id) || !isUuid(body.plan_version_id) || !isUuid(body.idempotency_key)) return json({ error: "invalid_subscription_request" }, 400)
  const claims = ctx.userClaims as { sub?: string } | undefined
  const userId = claims?.sub
  if (!userId) return json({ error: "authentication_required" }, 401)
  const { data: owned } = await ctx.supabase.from("server_listings").select("id,owner_user_id").eq("id", body.server_listing_id).maybeSingle()
  if (!owned || owned.owner_user_id !== userId) return json({ error: "listing_not_owned" }, 403)
  const { data: prepared, error: prepareError } = await ctx.supabaseAdmin.rpc("prepare_paypal_subscription", {
    p_user_id: userId, p_listing_id: body.server_listing_id, p_plan_version_id: body.plan_version_id, p_idempotency_key: body.idempotency_key,
  })
  if (prepareError || !prepared) return json({ error: "subscription_not_available" }, 409)
  if (prepared.existing && prepared.external_subscription_id) {
    const remote = await paypalRequest<{ links?: Array<{ rel?: string; href?: string }> }>(`/v1/billing/subscriptions/${encodeURIComponent(prepared.external_subscription_id)}`)
    const existingUrl = approvalUrl(remote.links)
    if (existingUrl) return json({ url: existingUrl, reused: true })
    return json({ error: "subscription_already_created" }, 409)
  }
  try {
    const created = await paypalRequest<{ id?: string; links?: Array<{ rel?: string; href?: string }> }>("/v1/billing/subscriptions", {
      method: "POST", requestId: String(body.idempotency_key), prefer: "return=representation",
      body: {
        plan_id: prepared.paypal_plan_id,
        custom_id: prepared.custom_id,
        application_context: {
          brand_name: "W.E.A.F",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${publicSite}/servers/success?provider=paypal&listing_id=${encodeURIComponent(String(body.server_listing_id))}`,
          cancel_url: `${publicSite}/servers/cancel?provider=paypal&listing_id=${encodeURIComponent(String(body.server_listing_id))}`,
        },
      },
    })
    const url = approvalUrl(created.links)
    if (!created.id || !url) throw new PayPalError("paypal_approval_url_missing", 502)
    const { error: attachError } = await ctx.supabaseAdmin.rpc("attach_paypal_subscription", { p_subscription_id: prepared.subscription_id, p_user_id: userId, p_external_subscription_id: created.id })
    if (attachError) throw new PayPalError("subscription_reconciliation_failed", 500)
    return json({ url })
  } catch (error) {
    console.error("create_paypal_subscription_failed", error instanceof PayPalError ? error.code : "unknown")
    return json({ error: error instanceof PayPalError ? error.code : "paypal_subscription_failed" }, error instanceof PayPalError ? error.status : 502)
  }
})

export default { fetch: (req: Request) => req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : handler(req) }
