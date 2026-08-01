import { PayPalError } from "./paypal.ts"

export type PayPalCapture = {
  id?: string
  status?: string
  amount?: { value?: string; currency_code?: string }
  create_time?: string
  update_time?: string
  supplementary_data?: { related_ids?: { order_id?: string } }
}

export type PreparedMarketplaceCapture = {
  payment_id: string
  listing_id: string
  paypal_order_id: string
  idempotency_key: string
  already_captured: boolean
  payment_status: string
  paypal_capture_id: string | null
  amount_minor: number
  currency: string
  environment: string
}

export type CaptureConfirmArgs = {
  p_payment_id: string
  p_user_id: string
  p_order_id: string
  p_capture_id: string
  p_amount_minor: number
  p_currency: string
  p_captured_at: string
}

export type MarketplaceCaptureDeps = {
  prepared: PreparedMarketplaceCapture
  userId: string
  getCapture: (captureId: string) => Promise<PayPalCapture>
  postCapture: (orderId: string, requestId: string) => Promise<PayPalCapture>
  confirm: (args: CaptureConfirmArgs) => Promise<{ error?: unknown; data?: { confirmed?: boolean; reused?: boolean } | null }>
  recordResponse: (paymentId: string, userId: string, captureId: string | null, status: string | null) => Promise<{ error?: unknown }>
}

export type MarketplaceCaptureOutcome =
  | { ok: true; status: "confirmed"; listing_id: string; reused: boolean }
  | { ok: true; status: "pending_confirmation"; listing_id: string }
  | { ok: false; code: string; status: number }

const expectedAmount = (minor: number) => (minor / 100).toFixed(2)

export async function resolveMarketplacePayPalCapture(
  deps: MarketplaceCaptureDeps,
): Promise<MarketplaceCaptureOutcome> {
  if (deps.prepared.already_captured) {
    return { ok: true, status: "confirmed", listing_id: deps.prepared.listing_id, reused: true }
  }
  try {
    const capture = deps.prepared.paypal_capture_id
      ? await deps.getCapture(deps.prepared.paypal_capture_id)
      : await deps.postCapture(deps.prepared.paypal_order_id, `${deps.prepared.idempotency_key}-capture`)

    if (!capture.id) throw new PayPalError("marketplace_capture_reconciliation_failed", 409)
    if (capture.amount?.value !== expectedAmount(deps.prepared.amount_minor) || capture.amount?.currency_code !== deps.prepared.currency) {
      throw new PayPalError("marketplace_capture_reconciliation_failed", 409)
    }
    if (deps.prepared.paypal_capture_id && capture.supplementary_data?.related_ids?.order_id !== deps.prepared.paypal_order_id) {
      throw new PayPalError("marketplace_capture_reconciliation_failed", 409)
    }

    if (capture.status === "COMPLETED") {
      const result = await deps.confirm({
        p_payment_id: deps.prepared.payment_id,
        p_user_id: deps.userId,
        p_order_id: deps.prepared.paypal_order_id,
        p_capture_id: capture.id,
        p_amount_minor: deps.prepared.amount_minor,
        p_currency: deps.prepared.currency,
        p_captured_at: capture.create_time || capture.update_time || new Date().toISOString(),
      })
      if (result.error) throw new PayPalError("marketplace_capture_reconciliation_failed", 500)
      if (result.data === null || result.data === undefined) throw new PayPalError("marketplace_capture_reconciliation_failed", 500)
      if (result.data.confirmed !== true) throw new PayPalError("marketplace_capture_reconciliation_failed", 500)
      return { ok: true, status: "confirmed", listing_id: deps.prepared.listing_id, reused: result.data.reused === true }
    }

    if (capture.status === "PENDING") {
      if (!deps.prepared.paypal_capture_id) {
        const { error: recordError } = await deps.recordResponse(deps.prepared.payment_id, deps.userId, capture.id, capture.status)
        if (recordError) throw new PayPalError("marketplace_capture_reconciliation_failed", 500)
      }
      return { ok: true, status: "pending_confirmation", listing_id: deps.prepared.listing_id }
    }

    throw new PayPalError("marketplace_capture_reconciliation_failed", 409)
  } catch (error) {
    if (error instanceof PayPalError) return { ok: false, code: error.code, status: error.status }
    return { ok: false, code: "marketplace_capture_failed", status: 502 }
  }
}
