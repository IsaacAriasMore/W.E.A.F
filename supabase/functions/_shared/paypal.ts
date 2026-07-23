export type PayPalMode = "sandbox" | "live"

type PayPalConfig = {
  mode: PayPalMode
  baseUrl: string
  clientId: string
  clientSecret: string
  webhookId: string
}

let cachedToken: { value: string; expiresAt: number } | null = null

export class PayPalError extends Error {
  status: number
  code: string
  details: unknown

  constructor(code: string, status: number, details?: unknown) {
    super(code)
    this.name = "PayPalError"
    this.status = status
    this.code = code
    this.details = details
  }
}

const safeJson = async (response: Response) => {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { throw new PayPalError("paypal_invalid_response", 502) }
}

export function getPayPalConfig(): PayPalConfig {
  const mode = (Deno.env.get("PAYPAL_MODE") || "sandbox") as PayPalMode
  if (mode !== "sandbox") throw new PayPalError("paypal_live_disabled", 503)
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") || ""
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET") || ""
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID") || ""
  const configuredBase = (Deno.env.get("PAYPAL_API_BASE") || "https://api-m.sandbox.paypal.com").replace(/\/$/, "")
  if (configuredBase !== "https://api-m.sandbox.paypal.com") throw new PayPalError("paypal_api_base_not_sandbox", 503)
  if (!clientId || !clientSecret) throw new PayPalError("paypal_not_configured", 503)
  return { mode, baseUrl: configuredBase, clientId, clientSecret, webhookId }
}

async function accessToken(config: PayPalConfig) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: "grant_type=client_credentials",
      signal: controller.signal,
    })
    const body = await safeJson(response) as { access_token?: string; expires_in?: number } | null
    if (!response.ok || !body?.access_token) throw new PayPalError("paypal_oauth_failed", 502, { status: response.status })
    cachedToken = { value: body.access_token, expiresAt: Date.now() + Math.max(60, body.expires_in || 300) * 1000 }
    return cachedToken.value
  } catch (error) {
    if (error instanceof PayPalError) throw error
    throw new PayPalError(error instanceof DOMException && error.name === "AbortError" ? "paypal_timeout" : "paypal_network_error", 502)
  } finally { clearTimeout(timeout) }
}

export async function paypalRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; requestId?: string; prefer?: string } = {},
): Promise<T> {
  const config = getPayPalConfig()
  const token = await accessToken(config)
  const method = options.method || "GET"
  const attempts = method === "GET" || Boolean(options.requestId) ? 2 : 1
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          "content-type": "application/json",
          ...(options.requestId ? { "PayPal-Request-Id": options.requestId } : {}),
          ...(options.prefer ? { Prefer: options.prefer } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })
      const body = await safeJson(response)
      if (response.ok) return body as T
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === attempts - 1) throw new PayPalError("paypal_api_error", response.status, body)
    } catch (error) {
      if (error instanceof PayPalError && (error.status < 500 || attempt === attempts - 1)) throw error
      if (error instanceof DOMException && error.name === "AbortError" && attempt === attempts - 1) throw new PayPalError("paypal_timeout", 504)
      if (attempt === attempts - 1) throw new PayPalError("paypal_network_error", 502)
    } finally { clearTimeout(timeout) }
  }
  throw new PayPalError("paypal_request_failed", 502)
}

export type BillingTerms = {
  currency: string
  base_price_minor: number
  promotional_price_minor: number
  frequency_unit: "DAY" | "WEEK" | "MONTH" | "YEAR"
  interval_count: number
  benefit_cycles?: number | null
  total_cycles?: number | null
  auto_renew: boolean
  end_behavior: "expire" | "same_price" | "base_price"
}

const money = (minor: number) => (minor / 100).toFixed(2)

export function paypalBillingCycles(terms: BillingTerms) {
  const frequency = { interval_unit: terms.frequency_unit, interval_count: terms.interval_count }
  const promotional = { fixed_price: { value: money(terms.promotional_price_minor), currency_code: terms.currency } }
  const base = { fixed_price: { value: money(terms.base_price_minor), currency_code: terms.currency } }
  if (terms.end_behavior === "base_price" && terms.promotional_price_minor !== terms.base_price_minor) {
    return [
      { frequency, tenure_type: "TRIAL", sequence: 1, total_cycles: terms.benefit_cycles || 1, pricing_scheme: promotional },
      { frequency, tenure_type: "REGULAR", sequence: 2, total_cycles: terms.auto_renew ? 0 : (terms.total_cycles || 1), pricing_scheme: base },
    ]
  }
  return [{
    frequency,
    tenure_type: "REGULAR",
    sequence: 1,
    total_cycles: terms.end_behavior === "expire" || !terms.auto_renew ? (terms.total_cycles || terms.benefit_cycles || 1) : 0,
    pricing_scheme: promotional,
  }]
}

export async function verifyPayPalWebhook(req: Request, event: unknown) {
  const config = getPayPalConfig()
  if (!config.webhookId) throw new PayPalError("paypal_webhook_not_configured", 503)
  const required = {
    auth_algo: req.headers.get("paypal-auth-algo"),
    cert_url: req.headers.get("paypal-cert-url"),
    transmission_id: req.headers.get("paypal-transmission-id"),
    transmission_sig: req.headers.get("paypal-transmission-sig"),
    transmission_time: req.headers.get("paypal-transmission-time"),
  }
  if (Object.values(required).some((value) => !value)) return false
  const result = await paypalRequest<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    requestId: crypto.randomUUID(),
    body: { ...required, webhook_id: config.webhookId, webhook_event: event },
  })
  return result.verification_status === "SUCCESS"
}

export const approvalUrl = (links: Array<{ rel?: string; href?: string }> = []) => links.find((link) => link.rel === "approve")?.href || ""
