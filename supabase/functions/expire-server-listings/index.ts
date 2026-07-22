import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "@supabase/supabase-js/cors"
import { withSupabase } from "@supabase/server"

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })

const handler = withSupabase({ auth: "secret" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed", message: "Usa una petición POST." }, 405)
  const { data, error } = await ctx.supabaseAdmin.rpc("expire_server_listings")
  if (error) {
    console.error("expire_server_listings_failed", error.code || "database_error")
    return json({ error: "listing_expiration_failed", message: "No se pudo completar la expiración." }, 500)
  }
  return json({ expired: Number(data || 0) })
})

export default {
  fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    return handler(req)
  },
}
