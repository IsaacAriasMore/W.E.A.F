import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "@supabase/supabase-js/cors"
import { withSupabase } from "@supabase/server"

const allowedEvents = new Set([
  "mutation_created",
  "propagator_available",
  "breed_completed",
  "member_joined",
])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders })

const authenticatedHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  const contentLength = Number(req.headers.get("content-length") || 0)
  if (contentLength > 4096) return json({ error: "payload_too_large" }, 413)

  let body: { tribeId?: string; eventType?: string; entityId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: "invalid_json" }, 400)
  }

  const actorId = (ctx.userClaims as { sub?: string; id?: string } | undefined)?.sub
    || (ctx.userClaims as { id?: string } | undefined)?.id
  if (!actorId) return json({ error: "authentication_required" }, 401)
  if (!body.tribeId || !uuidPattern.test(body.tribeId)
    || !body.entityId || !uuidPattern.test(body.entityId)
    || !body.eventType || !allowedEvents.has(body.eventType)) {
    return json({ error: "invalid_notification_request" }, 400)
  }

  const { data: prepared, error: prepareError } = await ctx.supabaseAdmin
    .rpc("prepare_discord_delivery", {
      p_tribe_id: body.tribeId,
      p_actor_user_id: actorId,
      p_event_type: body.eventType,
      p_entity_id: body.entityId,
    })
    .single()

  if (prepareError || !prepared) {
    const code = prepareError?.message?.includes("discord_rate_limit")
      ? "discord_rate_limit"
      : prepareError?.message?.includes("webhook_not_configured")
        ? "webhook_not_configured"
        : "notification_not_available"
    return json({ error: code }, code === "discord_rate_limit" ? 429 : 403)
  }

  const payload = {
    username: "W.E.A.F",
    allowed_mentions: { parse: [] },
    embeds: [{
      title: prepared.event_title,
      description: prepared.event_detail,
      color: 0xD49A42,
      footer: { text: prepared.tribe_name },
      timestamp: new Date().toISOString(),
    }],
  }

  let delivered = false
  let deliveryError: string | null = null
  try {
    const response = await fetch(prepared.webhook_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    delivered = response.ok
    if (!response.ok) deliveryError = `discord_http_${response.status}`
  } catch (error) {
    deliveryError = error instanceof Error ? error.name : "discord_network_error"
  }

  const { error: completionError } = await ctx.supabaseAdmin.rpc(
    "complete_discord_delivery",
    {
      p_delivery_id: prepared.delivery_id,
      p_success: delivered,
      p_error: deliveryError,
    },
  )
  if (completionError) console.error("discord_delivery_completion_failed", prepared.delivery_id)

  return delivered
    ? json({ delivered: true, deliveryId: prepared.delivery_id })
    : json({ delivered: false, error: "discord_delivery_failed" }, 502)
})

export default {
  fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    return authenticatedHandler(req)
  },
}
