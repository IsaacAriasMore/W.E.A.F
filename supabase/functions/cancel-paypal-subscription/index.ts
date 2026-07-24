import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "npm:@supabase/supabase-js@2.110.8/cors"
import { withSupabase } from "@supabase/server"
import { PayPalError, paypalRequest } from "../_shared/paypal.ts"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })
const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (Deno.env.get("PAYPAL_ENABLED") !== "true" || Deno.env.get("PAYPAL_MODE") !== "sandbox") return json({ error: "paypal_disabled" }, 503)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: "invalid_json" }, 400) }
  if (!/^[0-9a-f-]{36}$/i.test(String(body.subscription_id || "")) || body.confirm !== true) return json({ error: "cancellation_confirmation_required" }, 400)
  const reason = String(body.reason || "User requested cancellation").trim().slice(0, 127)
  const claims = ctx.userClaims as { sub?: string } | undefined
  const userId = claims?.sub
  if (!userId) return json({ error: "authentication_required" }, 401)
  const { data: selected, error } = await ctx.supabaseAdmin.rpc("get_paypal_subscription_for_cancel", { p_user_id: userId, p_subscription_id: body.subscription_id })
  if (error || !selected) return json({ error: "subscription_not_owned" }, 403)
  if (selected.already_terminal) return json({ cancelled: true, status: selected.status, idempotent: true })
  try {
    await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(selected.external_subscription_id)}/cancel`, {
      method: "POST", requestId: crypto.randomUUID(), body: { reason },
    })
    const { error: markError } = await ctx.supabaseAdmin.rpc("mark_paypal_cancellation_requested", { p_user_id: userId, p_subscription_id: body.subscription_id, p_reason: reason })
    if (markError) throw new PayPalError("cancellation_reconciliation_failed", 500)
    return json({ cancelled: true, status: "cancellation_pending" })
  } catch (requestError) {
    console.error("paypal_cancellation_failed", requestError instanceof PayPalError ? requestError.code : "unknown")
    return json({ error: requestError instanceof PayPalError ? requestError.code : "paypal_cancellation_failed" }, requestError instanceof PayPalError ? requestError.status : 502)
  }
})

export default { fetch: (req: Request) => req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : handler(req) }
