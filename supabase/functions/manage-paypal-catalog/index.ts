import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "@supabase/supabase-js/cors"
import { withSupabase } from "@supabase/server"
import { PayPalError, paypalBillingCycles, paypalRequest } from "../_shared/paypal.ts"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })
const uuid = (value: unknown) => /^[0-9a-f-]{36}$/i.test(String(value || ""))

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (Deno.env.get("PAYPAL_ENABLED") !== "true" || Deno.env.get("PAYPAL_MODE") !== "sandbox") return json({ error: "paypal_disabled" }, 503)
  const claims = ctx.userClaims as { sub?: string } | undefined
  const userId = claims?.sub
  if (!userId) return json({ error: "authentication_required" }, 401)
  const { data: profile } = await ctx.supabase.from("profiles").select("global_role").eq("id", userId).maybeSingle()
  if (profile?.global_role !== "admin") return json({ error: "global_admin_required" }, 403)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: "invalid_json" }, 400) }
  const action = String(body.action || "")
  try {
    if (action === "sync_product") {
      const { data: product } = await ctx.supabaseAdmin.from("billing_products").select("*").eq("code", "server_listing").single()
      if (!product) return json({ error: "billing_product_missing" }, 404)
      let externalId = product.external_product_id_sandbox || Deno.env.get("PAYPAL_PRODUCT_ID_SANDBOX") || ""
      if (!externalId) {
        const created = await paypalRequest<{ id?: string }>("/v1/catalogs/products", {
          method: "POST", requestId: product.id, prefer: "return=representation",
          body: { name: product.name, description: product.description, type: "SERVICE", category: "SOFTWARE" },
        })
        externalId = created.id || ""
      }
      if (!externalId) throw new PayPalError("paypal_product_id_missing", 502)
      await ctx.supabaseAdmin.rpc("complete_paypal_product_sync", { p_product_id: product.id, p_external_product_id: externalId, p_error: null })
      return json({ product_id: externalId, status: "synced" })
    }
    if (!uuid(body.plan_version_id)) return json({ error: "invalid_plan_version" }, 400)
    const versionId = String(body.plan_version_id)
    const { data: version, error } = await ctx.supabaseAdmin.rpc("get_paypal_plan_sync_payload", { p_version_id: versionId })
    if (error || !version) return json({ error: error?.message || "plan_version_not_found" }, 404)
    let planId = version.external_plan_id_sandbox || ""
    if (action === "sync_plan" || action === "retry_sync") {
      if (!version.external_product_id_sandbox) return json({ error: "paypal_product_not_synced" }, 409)
      if (!planId) {
        const created = await paypalRequest<{ id?: string; status?: string }>("/v1/billing/plans", {
          method: "POST", requestId: versionId, prefer: "return=representation",
          body: {
            product_id: version.external_product_id_sandbox,
            name: `${version.name} v${version.version_number}`.slice(0, 127),
            description: String(version.description || version.name).slice(0, 127),
            status: "ACTIVE",
            billing_cycles: paypalBillingCycles(version),
            payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: "CANCEL", payment_failure_threshold: 1 },
          },
        })
        planId = created.id || ""
      }
      if (!planId) throw new PayPalError("paypal_plan_id_missing", 502)
      await ctx.supabaseAdmin.rpc("complete_paypal_plan_sync", { p_version_id: versionId, p_external_plan_id: planId, p_provider_status: "ACTIVE", p_error: null })
      return json({ plan_id: planId, status: "synced" })
    }
    if (!planId) return json({ error: "paypal_plan_not_synced" }, 409)
    if (action === "activate_plan" || action === "deactivate_plan") {
      const verb = action === "activate_plan" ? "activate" : "deactivate"
      await paypalRequest(`/v1/billing/plans/${encodeURIComponent(planId)}/${verb}`, { method: "POST", requestId: crypto.randomUUID() })
      const providerStatus = action === "activate_plan" ? "ACTIVE" : "INACTIVE"
      await ctx.supabaseAdmin.rpc("complete_paypal_plan_sync", { p_version_id: versionId, p_external_plan_id: planId, p_provider_status: providerStatus, p_error: null })
      return json({ plan_id: planId, status: providerStatus })
    }
    if (action === "sync_status") {
      const remote = await paypalRequest<{ status?: string }>(`/v1/billing/plans/${encodeURIComponent(planId)}`)
      await ctx.supabaseAdmin.rpc("complete_paypal_plan_sync", { p_version_id: versionId, p_external_plan_id: planId, p_provider_status: remote.status || "UNKNOWN", p_error: null })
      return json({ plan_id: planId, status: remote.status || "UNKNOWN" })
    }
    return json({ error: "unsupported_action" }, 400)
  } catch (error) {
    console.error("paypal_catalog_action_failed", action, error instanceof PayPalError ? error.code : "unknown")
    if (uuid(body.plan_version_id)) await ctx.supabaseAdmin.rpc("complete_paypal_plan_sync", { p_version_id: body.plan_version_id, p_external_plan_id: null, p_provider_status: "ERROR", p_error: error instanceof PayPalError ? error.code : "paypal_catalog_failed" })
    return json({ error: error instanceof PayPalError ? error.code : "paypal_catalog_failed" }, error instanceof PayPalError ? error.status : 502)
  }
})

export default { fetch: (req: Request) => req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : handler(req) }
