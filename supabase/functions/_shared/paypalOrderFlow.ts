import { approvalUrl, PayPalError } from "./paypal.ts"

export type PayPalOrderLinks = Array<{ rel?: string; href?: string }>

export type PayPalCreatedOrder = {
  id?: string
  status?: string
  links?: PayPalOrderLinks
}

export type PreparedMarketplaceOrder = {
  payment_id: string
  amount_minor: number
  currency: string
  custom_id?: string | null
  paypal_order_id: string | null
  existing: boolean
  idempotency_key: string
}

export type MarketplaceOrderDeps = {
  prepared: PreparedMarketplaceOrder
  createOrder: (requestId: string) => Promise<PayPalCreatedOrder>
  getOrder: (paypalOrderId: string) => Promise<PayPalCreatedOrder>
  attachOrder: (paymentId: string, paypalOrderId: string) => Promise<void>
  closeCreation: (paymentId: string, reason: string) => Promise<boolean>
}

export type MarketplaceOrderOutcome =
  | { ok: true; url: string; reused: boolean }
  | { ok: false; code: string; status: number; sanitized?: unknown }

const relNames = (links: PayPalOrderLinks | undefined): string[] =>
  (links || [])
    .map((link) => (typeof link.rel === "string" ? link.rel.slice(0, 32) : null))
    .filter((rel): rel is string => Boolean(rel))
    .slice(0, 10)

export async function resolveMarketplacePayPalOrder(
  deps: MarketplaceOrderDeps,
): Promise<MarketplaceOrderOutcome> {
  let remotePayPalOrderId: string | null = null
  try {
    if (deps.prepared.paypal_order_id) {
      const existing = await deps.getOrder(deps.prepared.paypal_order_id)
      const url = approvalUrl(existing.links)
      if (url) return { ok: true, url, reused: true }
      return {
        ok: false,
        code: existing.status === "COMPLETED" ? "marketplace_order_completed" : "marketplace_order_not_approvable",
        status: 409,
      }
    }
    const created = await deps.createOrder(String(deps.prepared.idempotency_key))
    if (!created.id) {
      throw new PayPalError("paypal_approval_url_missing", 502, { order_id_present: false })
    }
    remotePayPalOrderId = created.id
    await deps.attachOrder(String(deps.prepared.payment_id), created.id)
    const url = approvalUrl(created.links)
    if (!url) {
      throw new PayPalError("paypal_approval_url_missing", 502, {
        order_id_present: true,
        status: typeof created.status === "string" ? created.status.slice(0, 40) : null,
        link_rels: relNames(created.links),
      })
    }
    return { ok: true, url, reused: false }
  } catch (error) {
    const original = error instanceof PayPalError ? error : null
    if (original && remotePayPalOrderId === null && !deps.prepared.paypal_order_id) {
      let closed = false
      try {
        closed = await deps.closeCreation(String(deps.prepared.payment_id), original.code)
      } catch {
        closed = false
      }
      if (!closed) {
        return {
          ok: false,
          code: "marketplace_order_reconciliation_failed",
          status: 500,
          sanitized: { original_error_code: original.code, recovery_failed: true, status: 500 },
        }
      }
    }
    if (original) {
      const sanitized = original.code === "paypal_approval_url_missing" && original.details
        ? original.details
        : undefined
      return {
        ok: false,
        code: original.code,
        status: original.status,
        ...(sanitized !== undefined ? { sanitized } : {}),
      }
    }
    return { ok: false, code: "marketplace_order_failed", status: 502 }
  }
}
