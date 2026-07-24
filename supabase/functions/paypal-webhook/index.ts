// @ts-ignore
import { withSupabase } from "npm:@supabase/server@0.2.3"
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

const minor = (value: unknown) => {
  const amount = Number(value)

  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : 0
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

    if (
      !event.id ||
      !eventType ||
      !eventTypes.has(eventType)
    ) {
      return json({
        received: true,
        processed: false,
        reason: "unsupported_event",
      })
    }

    try {
      const verified =
        await verifyPayPalWebhook(
          req,
          event,
        )

      if (!verified) {
        return json(
          {
            error:
              "invalid_paypal_signature",
          },
          400,
        )
      }
    } catch (error) {
      console.error(
        "paypal_webhook_verification_failed",
        error instanceof PayPalError
          ? error.code
          : "unknown",
      )

      return json(
        {
          error:
            error instanceof PayPalError
              ? error.code
              : "webhook_verification_failed",
        },
        error instanceof PayPalError
          ? error.status
          : 502,
      )
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