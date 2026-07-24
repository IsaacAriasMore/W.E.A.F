import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "npm:@supabase/supabase-js@2.110.8/cors"
import { withSupabase } from "@supabase/server"
import { PayPalError, paypalRequest } from "../_shared/paypal.ts"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })
const handler = withSupabase({ auth: "secret" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (Deno.env.get("PAYPAL_ENABLED") !== "true" || Deno.env.get("PAYPAL_MODE") !== "sandbox") return json({ error: "paypal_disabled" }, 503)
  let requestedLimit = 25
  try { requestedLimit = Number((await req.json())?.limit || 25) } catch { /* optional body */ }
  const { data: batch, error } = await ctx.supabaseAdmin.rpc("get_paypal_reconciliation_batch", { p_limit: Math.min(Math.max(requestedLimit, 1), 50) })
  if (error) return json({ error: "reconciliation_batch_failed" }, 500)
  const summary = { checked: 0, updated: 0, failed: 0, alerts: [] as Array<{ subscription_id: string; error: string }> }
  for (const item of batch || []) {
    summary.checked += 1
    try {
      const remote = await paypalRequest<any>(`/v1/billing/subscriptions/${encodeURIComponent(item.external_subscription_id)}`)
      const providerTime = remote.update_time || remote.create_time || new Date().toISOString()
      const nextBilling = remote.billing_info?.next_billing_time || null
      const { error: applyError } = await ctx.supabaseAdmin.rpc("apply_paypal_reconciliation", {
        p_subscription_id: item.id, p_status: remote.status || "UNKNOWN", p_next_billing_time: nextBilling,
        p_provider_time: providerTime, p_error: null,
      })
      if (applyError) throw new PayPalError("reconciliation_update_failed", 500)
      summary.updated += 1
    } catch (requestError) {
      summary.failed += 1
      const code = requestError instanceof PayPalError ? requestError.code : "reconciliation_failed"
      summary.alerts.push({ subscription_id: item.id, error: code })
      await ctx.supabaseAdmin.rpc("apply_paypal_reconciliation", {
        p_subscription_id: item.id, p_status: item.status, p_next_billing_time: null,
        p_provider_time: item.provider_updated_at || new Date().toISOString(), p_error: code,
      })
    }
  }
  return json(summary)
})

export default { fetch: (req: Request) => req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : handler(req) }
