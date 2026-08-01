import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "npm:@supabase/supabase-js@2.110.8/cors"
import { withSupabase } from "@supabase/server"
import { PayPalError, paypalRequest } from "../_shared/paypal.ts"
import { resolveMarketplacePayPalCapture } from "../_shared/paypalCaptureFlow.ts"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })
const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""))

type PayPalCaptureResponse = {
  status?: string
  purchase_units?: Array<{ payments?: { captures?: Array<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string }; create_time?: string; update_time?: string }> } }>
}

const normalizeCapture = (body: PayPalCaptureResponse) => {
  const capture = body.purchase_units?.flatMap((unit) => unit.payments?.captures || [])[0] || {}
  return { id: capture.id, status: capture.status, amount: capture.amount, create_time: capture.create_time, update_time: capture.update_time }
}

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (Number(req.headers.get("content-length") || 0) > 1024) return json({ error: "payload_too_large" }, 413)
  if (Deno.env.get("PAYPAL_ENABLED") !== "true" || Deno.env.get("PAYPAL_MODE") !== "sandbox") return json({ error: "marketplace_payments_disabled" }, 503)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: "invalid_json" }, 400) }
  if (!isUuid(body.payment_id)) return json({ error: "invalid_marketplace_capture" }, 400)
  const userId = ctx.userClaims?.sub || ctx.userClaims?.id
  if (!userId) return json({ error: "authentication_required" }, 401)
  const { data: prepared, error: prepareError } = await ctx.supabaseAdmin.rpc("prepare_marketplace_paypal_capture", { p_payment_id: body.payment_id, p_user_id: userId })
  if (prepareError || !prepared) return json({ error: "marketplace_payment_not_available" }, 409)
  try {
    const outcome = await resolveMarketplacePayPalCapture({
      prepared,
      userId,
      getCapture: (captureId) => paypalRequest<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string }; create_time?: string; update_time?: string; supplementary_data?: { related_ids?: { order_id?: string } } }>(`/v2/payments/captures/${encodeURIComponent(captureId)}`, { method: "GET" }),
      postCapture: (orderId, requestId) => paypalRequest<PayPalCaptureResponse>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST", requestId, prefer: "return=representation", body: {},
      }).then(normalizeCapture),
      confirm: (args) => ctx.supabaseAdmin.rpc("confirm_marketplace_paypal_capture_from_api", args),
      recordResponse: (paymentId, paymentUserId, captureId, status) => ctx.supabaseAdmin.rpc("record_marketplace_capture_response", {
        p_payment_id: paymentId, p_user_id: paymentUserId, p_capture_id: captureId, p_status: status,
      }),
    })
    if (!outcome.ok) throw new PayPalError(outcome.code, outcome.status)
    if (outcome.status === "confirmed") return json({ status: "confirmed", listing_id: outcome.listing_id, reused: outcome.reused })
    return json({ status: "pending_confirmation", listing_id: outcome.listing_id })
  } catch (error) {
    console.error("capture_marketplace_paypal_order_failed", error instanceof PayPalError ? error.code : "unknown")
    return json({ error: error instanceof PayPalError ? error.code : "marketplace_capture_failed" }, error instanceof PayPalError ? error.status : 502)
  }
})

export default { fetch: (req: Request) => req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : handler(req) }
