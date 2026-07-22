import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "@supabase/supabase-js/cors"
import { withSupabase } from "@supabase/server"

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const allowedEvents = new Set(["impression", "discord_click", "website_click"])
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })

function ignored(reason: string, listingId: string, eventType: string, error?: unknown) {
  console.warn("[track-server-event] non-critical tracking ignored", {
    error: error instanceof Error ? error.message : String(error || reason),
    listingId,
    eventType,
  })
  return json({ recorded: false, ignored: true, reason })
}

function safeReferrer(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`.slice(0, 500)
  } catch {
    return null
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

    return withSupabase({ auth: "none" }, async (request, ctx) => {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)
      if (Number(request.headers.get("content-length") || 0) > 2048) return json({ error: "payload_too_large" }, 413)

      let body: { listingId?: string; eventType?: string }
      try {
        body = await request.json()
      } catch {
        return json({ error: "invalid_json" }, 400)
      }

      if (!body.listingId || !uuidPattern.test(body.listingId)
        || !body.eventType || !allowedEvents.has(body.eventType)) {
        return json({ error: "invalid_server_event" }, 400)
      }

      const forwarded = request.headers.get("cf-connecting-ip")
        || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || "unknown"
      const secret = Deno.env.get("CLICK_HASH_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      if (!secret) return ignored("tracking_not_configured", body.listingId, body.eventType)

      try {
        const ipHash = await sha256(`${secret}:${forwarded}`)
        const { data, error } = await ctx.supabaseAdmin.rpc("record_server_listing_event", {
          p_listing_id: body.listingId,
          p_event: body.eventType,
          p_ip_hash: ipHash,
          p_referrer: safeReferrer(request.headers.get("referer")),
        })

        if (error) {
          const reason = error.message.includes("listing_not_available")
            ? "listing_not_available"
            : "tracking_failed"
          return ignored(reason, body.listingId, body.eventType, error)
        }
        return json({ recorded: Boolean(data) })
      } catch (error) {
        return ignored("tracking_failed", body.listingId, body.eventType, error)
      }
    })(req)
  },
}
