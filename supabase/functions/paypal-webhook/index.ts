// @ts-ignore
import { withSupabase } from "@supabase/server"
import { PayPalError, verifyPayPalWebhook } from "../_shared/paypal.ts"

type RuntimeDeno = {
  env: {
    get(name: string): string | undefined
  }
}

type RpcError = {
  code?: string
  message?: string
} | null

type WebhookContext = {
  supabaseAdmin: {
    rpc(
      functionName: string,
      args: Record<string, unknown>,
    ): Promise<{
      data: unknown
      error: RpcError
    }>
  }
}

const runtime = globalThis as typeof globalThis & {
  Deno?: RuntimeDeno
}

const getEnv = (name: string) =>
  runtime.Deno?.env.get(name)

const json = (
  body: unknown,
  status = 200,
) =>
  Response.json(body, {
    status,
    headers: {
      "content-type": "application/json",
    },
  })

const eventTypes = new Set([
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.SALE.REVERSED",
])

const marketplaceEventTypes = new Set([
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
])

const minor = (value: unknown) => {
  const amount = Number(value)

  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : 0
}

const knownMarketplaceErrors = new Set([
  "marketplace_capture_reconciliation_failed",
  "marketplace_listing_not_eligible",
  "invalid_marketplace_payment_configuration",
  "invalid_event_id",
  "invalid_event_type",
  "invalid_event_payload",
  "resource_not_found",
])

const marketplaceFailureCode = (
  message?: string,
) => {
  if (message && knownMarketplaceErrors.has(message)) {
    return message
  }

  return "marketplace_processing_failed"
}

const handler = withSupabase(
  { auth: "none" },

  async (
    req: Request,
    ctx: WebhookContext,
  ) => {
    if (req.method !== "POST") {
      return json(
        { error: "method_not_allowed" },
        405,
      )
    }

    if (
      getEnv("PAYPAL_ENABLED") !== "true" ||
      getEnv("PAYPAL_MODE") !== "sandbox"
    ) {
      return json(
        { error: "paypal_disabled" },
        503,
      )
    }

    const declared = Number(
      req.headers.get("content-length") || 0,
    )

    if (declared > 1024 * 1024) {
      return json(
        { error: "payload_too_large" },
        413,
      )
    }

    const raw = await req.text()

    if (raw.length > 1024 * 1024) {
      return json(
        { error: "payload_too_large" },
        413,
      )
    }

    let event: Record<string, any>

    try {
      event = JSON.parse(raw)
    } catch {
      return json(
        { error: "invalid_json" },
        400,
      )
    }

    const eventType = String(
      event.event_type || "",
    )

    if (!event.id || !eventType) {
      return json({ error: "invalid_paypal_event" }, 400)
    }

    try {
      const verified = await verifyPayPalWebhook(req, event)

      if (!verified) {
        return json({ error: "invalid_paypal_signature" }, 400)
      }
    } catch (error) {
      console.error(
        "paypal_webhook_verification_failed",
        error instanceof PayPalError ? error.code : "unknown",
      )

      return json(
        { error: error instanceof PayPalError ? error.code : "webhook_verification_failed" },
        error instanceof PayPalError ? error.status : 502,
      )
    }

    if (!eventTypes.has(eventType) && !marketplaceEventTypes.has(eventType)) {
      return json({
        received: true,
        processed: false,
        reason: "unsupported_event",
      })
    }

    const resource =
      event.resource || {}

    const billingInfo =
      resource.billing_info || {}

    const amount =
      resource.amount ||
      resource.gross_amount ||
      resource
        .amount_with_breakdown
        ?.gross_amount ||
      {}

    const related =
      resource
        .supplementary_data
        ?.related_ids || {}

    if (marketplaceEventTypes.has(eventType)) {
      const marketplaceAmount = resource.amount || resource.purchase_units?.[0]?.amount || {}
      const marketplaceData = {
        order_id: eventType === "CHECKOUT.ORDER.APPROVED" ? resource.id : (related.order_id || null),
        capture_id: eventType.startsWith("PAYMENT.CAPTURE.") ? (resource.id || null) : null,
        custom_id: resource.custom_id || resource.purchase_units?.[0]?.custom_id || null,
        amount_minor: minor(marketplaceAmount.value),
        currency: marketplaceAmount.currency_code || null,
        event_time: event.create_time || resource.update_time || resource.create_time || new Date().toISOString(),
      }
      const { data: processed, error } = await ctx.supabaseAdmin.rpc("process_marketplace_paypal_event", {
        p_event_id: event.id, p_event_type: eventType, p_data: marketplaceData, p_payload: event,
      })
      if (error) {
        console.error("paypal_marketplace_event_failed", eventType, error.code || "database_error")
        const { error: auditError } = await ctx.supabaseAdmin.rpc("record_marketplace_paypal_event_failure", {
          p_event_id: event.id,
          p_event_type: eventType,
          p_resource_id: marketplaceData.order_id || marketplaceData.capture_id || marketplaceData.custom_id,
          p_payload: event,
          p_event_time: marketplaceData.event_time,
          p_processing_error: marketplaceFailureCode(error.message),
        })
        if (auditError) {
          console.error("paypal_marketplace_event_failure_audit_failed", eventType, auditError.code || "database_error")
        }
        return json({ error: "paypal_marketplace_event_failed" }, 500)
      }
      return json({ received: true, processed: Boolean(processed) })
    }

    const subscriptionId =
      resource.billing_agreement_id ||
      related.billing_agreement_id ||
      (
        eventType.startsWith(
          "BILLING.SUBSCRIPTION.",
        )
          ? resource.id
          : ""
      )

    let paymentId = ""

    if (
      eventType.startsWith(
        "PAYMENT.SALE.",
      )
    ) {
      paymentId =
        resource.sale_id ||
        related.sale_id ||
        resource.id ||
        ""
    } else {
      paymentId =
        related.sale_id || ""
    }

    const data = {
      subscription_id:
        subscriptionId || null,

      payment_id:
        paymentId || null,

      custom_id:
        resource.custom_id || null,

      status:
        resource.status ||
        resource.state ||
        null,

      amount_minor: minor(
        amount.value ||
        amount.total ||
        resource.amount?.value ||
        resource.amount?.total,
      ),

      currency:
        amount.currency_code ||
        amount.currency ||
        resource.amount
          ?.currency_code ||
        resource.amount
          ?.currency ||
        null,

      event_time:
        event.create_time ||
        resource.update_time ||
        resource.create_time ||
        new Date().toISOString(),

      next_billing_time:
        billingInfo
          .next_billing_time ||
        null,

      reason:
        resource
          .status_change_note ||
        resource.reason_code ||
        resource
          .refund_reason_code ||
        resource.state ||
        null,
    }

    const {
      data: processed,
      error,
    } =
      await ctx.supabaseAdmin.rpc(
        "process_paypal_billing_event",
        {
          p_event_id: event.id,
          p_event_type: eventType,
          p_data: data,
          p_payload: event,
        },
      )

    if (error) {
      console.error(
        "paypal_event_reconciliation_failed",
        event.id,
        eventType,
        error.code ||
          "database_error",
      )

      return json(
        {
          error:
            "paypal_event_reconciliation_failed",
        },
        500,
      )
    }

    return json({
      received: true,
      processed:
        Boolean(processed),
    })
  },
)

export default {
  fetch: (req: Request) =>
    handler(req),
}
