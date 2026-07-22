# Facturación de publicaciones con Stripe

W.E.A.F cobra publicaciones mensuales mediante Stripe Checkout en modo `subscription`. El navegador nunca recibe `STRIPE_SECRET_KEY`: únicamente solicita una sesión a una Edge Function autenticada y luego abre la URL alojada por Stripe.

## Flujo

1. El usuario autenticado elige `normal` o `plus`, completa la ficha y `save_server_listing_draft` la guarda como propia y no pública.
2. `create-server-listing-checkout` verifica nuevamente la propiedad, crea o reutiliza un Customer y crea Checkout con el Price mensual configurado.
3. La ficha queda en `pending_payment`. La redirección de éxito no activa nada por sí sola.
4. `stripe-webhook` verifica el cuerpo crudo con `STRIPE_WEBHOOK_SECRET`. Solo entonces la base marca el pago y activa la ficha.
5. Normal aparece en el directorio; Plus se activa además con `is_featured=true` y se ordena primero.
6. El portal de Stripe permite gestionar o cancelar la suscripción. Los webhooks actualizan la publicación y `expire-server-listings` cierra periodos vencidos.

El flujo manual del administrador sigue disponible. Una publicación activada por un administrador sin suscripción queda con `billing_source='manual'`; no se crea un pago ficticio ni se mezcla con Stripe.

## Variables

En Vercel:

```dotenv
VITE_BILLING_ENABLED=true
VITE_STRIPE_ENABLED=true
VITE_STRIPE_PUBLIC_KEY=<STRIPE_PUBLISHABLE_KEY>
VITE_PUBLIC_SITE_URL=https://weaf.vercel.app
```

En Supabase Edge Function Secrets:

```dotenv
BILLING_ENABLED=true
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=<STRIPE_SECRET_KEY>
STRIPE_WEBHOOK_SECRET=<STRIPE_WEBHOOK_SECRET>
STRIPE_PRICE_SERVER_NORMAL_MONTHLY=<STRIPE_NORMAL_PRICE_ID>
STRIPE_PRICE_SERVER_PLUS_MONTHLY=<STRIPE_PLUS_PRICE_ID>
PUBLIC_SITE_URL=https://weaf.vercel.app
```

La clave pública se reserva para una integración futura de Stripe.js. El Checkout actual es una redirección server-side y no necesita usarla en el navegador.

## Stripe Dashboard

Crea dos productos con precios recurrentes mensuales en USD:

- `W.E.A.F Server Listing Normal`: USD 3 por mes.
- `W.E.A.F Server Listing Plus`: USD 7 por mes.

Registra este endpoint:

```text
https://vwxqewpvtucygbaethkv.supabase.co/functions/v1/stripe-webhook
```

Suscribe como mínimo:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

El secret de un endpoint creado en Dashboard no es intercambiable con el secret temporal de `stripe listen`.

## Migrar y desplegar

Desde la raíz del proyecto:

```powershell
npx supabase login
npx supabase link --project-ref vwxqewpvtucygbaethkv
npx supabase functions deploy create-server-listing-checkout
npx supabase functions deploy create-billing-portal-session
npx supabase functions deploy expire-server-listings
npx supabase functions deploy stripe-webhook
```

La migración `20260722052913_stripe_listing_billing_flow.sql` ya está aplicada en el proyecto W.E.A.F. Antes de usar `npx supabase db push` en otra instalación, comprueba `npx supabase migration list` y sincroniza el historial de migraciones de esa instalación.

Los tres endpoints usan `verify_jwt=false` en `supabase/config.toml` porque `@supabase/server` realiza la autorización dentro de la función: `auth: "user"` para checkout/portal y `auth: "secret"` para expiración. El webhook acepta tráfico sin JWT, pero exige la firma de Stripe sobre el cuerpo crudo.

Configura secrets sin guardarlos en el repositorio:

```powershell
npx supabase secrets set BILLING_ENABLED=true STRIPE_ENABLED=true STRIPE_SECRET_KEY=<STRIPE_SECRET_KEY> STRIPE_WEBHOOK_SECRET=<STRIPE_WEBHOOK_SECRET> STRIPE_PRICE_SERVER_NORMAL_MONTHLY=<STRIPE_NORMAL_PRICE_ID> STRIPE_PRICE_SERVER_PLUS_MONTHLY=<STRIPE_PLUS_PRICE_ID> PUBLIC_SITE_URL=https://weaf.vercel.app --project-ref vwxqewpvtucygbaethkv
```

## Expiración programada

La función `expire-server-listings` solo acepta una Supabase secret key. Para Cron, almacena la URL del proyecto y una secret key dedicada en Supabase Vault y llama la función con `pg_cron` + `pg_net`, enviando la clave en el header `apikey`. Nunca escribas esa clave directamente en una migración.

También puede ejecutarse manualmente desde un backend autorizado:

```powershell
curl.exe -X POST "https://vwxqewpvtucygbaethkv.supabase.co/functions/v1/expire-server-listings" -H "apikey: $env:SUPABASE_SECRET_KEY" -H "Content-Type: application/json" -d "{}"
```

La consulta no expira una publicación Stripe si `current_period_end` todavía está vigente.

## Pruebas

En modo test usa `4242 4242 4242 4242`, una fecha futura y cualquier CVC. Verifica:

1. El usuario A no puede iniciar Checkout para una ficha del usuario B.
2. Una redirección a `/servers/success` permanece pendiente hasta el webhook.
3. `checkout.session.completed` activa la ficha y Plus queda destacado.
4. Reenviar el mismo evento no duplica suscripción ni pagos (`private.stripe_events.id` es único).
5. `invoice.payment_failed` pausa y oculta la ficha.
6. `invoice.paid` renueva `current_period_end` y reactiva la ficha.
7. `customer.subscription.deleted` cancela y oculta la ficha.
8. El portal vuelve a `/account/billing`.

Antes de producción reemplaza `pk_test_`, `sk_test_`, los Price IDs test y el webhook secret por sus equivalentes live. Confirma también branding, política de reembolsos, impuestos, moneda y el Customer Portal en Stripe.

## Modo degradado

Con `VITE_BILLING_ENABLED=false` o `VITE_STRIPE_ENABLED=false`, el frontend guarda la ficha pero no llama Checkout. La publicación permanece no pública hasta que un administrador la active manualmente. Los flags privados `BILLING_ENABLED` y `STRIPE_ENABLED` impiden además crear sesiones aunque alguien invoque directamente la función.
# Visibilidad después de cancelar

W.E.A.F retira una publicación Stripe de la zona pública cuando ocurre cualquiera de estos estados:

- `customer.subscription.deleted`: estado `canceled`, pago `canceled` y sin destacado.
- `customer.subscription.updated` con `cancel_at_period_end=true`: estado y pago `canceled` de inmediato, sin destacado.
- Suscripción `canceled`, `unpaid`, `incomplete_expired` o `past_due`: cancelada o pausada según el estado de pago.
- `invoice.payment_failed`: estado `paused`, pago `failed` y sin destacado.

La protección existe en dos capas. El trigger de base de datos normaliza el estado aunque el webhook reciba una actualización activa con cancelación programada. La política RLS y la consulta pública solo exponen publicaciones activas con pago confirmado o publicaciones manuales con `payment_status=not_required`/`paid`.

El propietario y el admin global conservan lectura del registro cancelado. Solo un admin global puede reactivar manualmente una publicación sin suscripción Stripe; el trigger la marca como `billing_source=manual` y `payment_status=not_required`.

## Prueba de cancelación

1. Completar Checkout test con Plus.
2. Confirmar `status=active`, `payment_status=paid` e `is_featured=true`.
3. Cancelar en Billing Portal.
4. Confirmar la entrega de `customer.subscription.updated` con `cancel_at_period_end=true`.
5. Confirmar `status=canceled`, `payment_status=canceled`, `is_featured=false` y ausencia en `/servers`.
6. Reactivar la suscripción y confirmar que un evento `active` con `cancel_at_period_end=false` devuelve la ficha a `active`/`paid`.
