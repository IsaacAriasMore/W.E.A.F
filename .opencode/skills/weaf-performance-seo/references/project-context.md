# Contexto técnico de W.E.A.F

- Repositorio: https://github.com/IsaacAriasMore/W.E.A.F
- Producción: https://weaf.vercel.app/
- PR previo: https://github.com/IsaacAriasMore/W.E.A.F/pull/4
- Merge commit PR #4: `9f04d868ba877771c409e465ee22dcb69510f154`
- Ruta local: `E:\W.E.A.F\W.E.A.F`
- Rama actual: `codex/performance-seo-lighthouse-90`
- Frontend: Vite/JavaScript SPA.
- Hosting: Vercel.
- Backend/Auth: Supabase.
- Supabase ref: `vwxqewpvtucygbaethkv`.
- Vercel project: `weaf`.

IDs de proyecto no son secretos; claves y tokens sí lo son.

Mantener:

- `paypal_payments=false`
- Marketplace `payments_enabled=false`
- `PAYPAL_MODE=sandbox`
- CAPTCHA/Turnstile activos.

No tocar Supabase Auth remoto, RLS, Edge Functions, migraciones, cron, variables Vercel, PayPal Live ni producción.

## Trabajo separado pendiente del Marketplace

No mezclar con este PR:

- tres migraciones;
- Edge Function;
- personalización server-side;
- allowlist QA;
- pruebas PayPal Sandbox.
