# Facturación de publicaciones con PayPal Subscriptions

W.E.A.F cobra publicaciones mensuales mediante PayPal Subscriptions en modo Sandbox. El navegador nunca recibe `PAYPAL_CLIENT_SECRET`: únicamente solicita una suscripción a una Edge Function autenticada y luego redirige a la URL oficial de aprobación de PayPal.

## Arquitectura

### Planes base

| Plan | Precio | Destacado | Descripción |
|------|--------|-----------|-------------|
| Normal | $3 USD/mes | No | Publicación visible mientras la suscripción esté activa |
| Plus | $7 USD/mes | Sí | Publicación visible + destacada + promoción interna |

### Tablas nuevas

- `billing_products` — Catálogo de productos (server_listing)
- `billing_plans` — Planes base (normal, plus)
- `billing_plan_versions` — Versiones de precio por plan/oferta
- `billing_offers` — Ofertas promocionales con ventanas de adquisición
- `billing_subscriptions` — Ciclo de vida de suscripciones
- `billing_payments` — Historial de pagos
- `private.billing_events` — Eventos idempotentes de PayPal
- `private.billing_audit_log` — Historial de cambios administrativos

### Edge Functions

| Función | Auth | Descripción |
|---------|------|-------------|
| `create-paypal-subscription` | user | Crear suscripción y obtener URL de aprobación |
| `cancel-paypal-subscription` | user | Cancelar suscripción propias |
| `paypal-webhook` | none | Recibir y verificar eventos de PayPal |
| `reconcile-paypal-subscriptions` | secret | Reconciliar estados con PayPal |
| `manage-paypal-catalog` | user (admin) | Sincronizar productos/planes con PayPal |

## Flujo

1. El usuario elige Normal o Plus, completa la ficha y `save_server_listing_draft` la guarda como propia y no pública.
2. `create-paypal-subscription` verifica propiedad, valida plan/oferta, crea registro local en estado `pending` y llama a PayPal REST para crear la suscripción.
3. PayPal devuelve una URL de aprobación. El navegador redirige al usuario.
4. El usuario aprueba el pago en PayPal. La ficha permanece `pending_payment`.
5. `paypal-webhook` verifica la firma oficial, procesa `PAYMENT.SALE.COMPLETED` y activa la ficha.
6. Normal aparece en el directorio; Plus se activa con `is_featured=true`.
7. La sección de facturación permite ver suscripciones, pagos y cancelar.

### Creación de suscripción

```
Usuario → Frontend → create-paypal-subscription → PayPal REST → URL de aprobación
                                    ↓
                          prepare_paypal_subscription (RPC)
                          attach_paypal_subscription (RPC)
```

### Webhook

```
PayPal → paypal-webhook → verify_paypal_webhook_signature → process_paypal_billing_event (RPC)
```

### Cancelación

```
Usuario → Frontend → cancel-paypal-subscription → PayPal REST cancel → mark_paypal_cancellation_requested (RPC)
```

### Reconciliación

```
Cron/Manual → reconcile-paypal-subscriptions → get_paypal_reconciliation_batch (RPC) → PayPal REST → apply_paypal_reconciliation (RPC)
```

## Variables de entorno

### Vercel (Frontend)

```dotenv
VITE_BILLING_ENABLED=true
VITE_PAYPAL_ENABLED=true
VITE_PAYPAL_MODE=sandbox
VITE_PUBLIC_SITE_URL=https://weaf.vercel.app
```

### Supabase Edge Function Secrets

```dotenv
BILLING_ENABLED=true
PAYPAL_ENABLED=true
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=<PAYPAL_CLIENT_ID>
PAYPAL_CLIENT_SECRET=<PAYPAL_CLIENT_SECRET>
PAYPAL_WEBHOOK_ID=<PAYPAL_WEBHOOK_ID>
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
PAYPAL_PRODUCT_ID_SANDBOX=<PAYPAL_PRODUCT_ID>
PUBLIC_SITE_URL=https://weaf.vercel.app
```

**Nunca** guardes estos valores en el repositorio.

## PayPal Dashboard

### Crear aplicación Sandbox

1. Ve a [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard/)
2. Crea una aplicación Sandbox
3. Copia el Client ID y Secret
4. En la sección Webhooks, crea un endpoint con los eventos listados abajo

### URL del webhook

```text
https://vwxqewpvtucygbaethkv.supabase.co/functions/v1/paypal-webhook
```

### Eventos PayPal requeridos

- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`
- `PAYMENT.SALE.REVERSED`

### Crear producto y planes

Usa la función `manage-paypal-catalog` desde el panel de administración:

1. Ve a Admin → Planes y ofertas
2. Haz clic en "Sincronizar producto" para crear el producto en PayPal
3. Para cada versión de plan, haz clic en "Sincronizar plan"

O manualmente en PayPal Dashboard:
1. Crea un producto tipo `SERVICE` llamado "W.E.A.F Server Listings"
2. Crea planes mensuales para Normal ($3) y Plus ($7)

## Despliegue

```powershell
npx supabase login
npx supabase link --project-ref vwxqewpvtucygbaethkv

# Aplicar migración
npx supabase db push

# Desplegar Edge Functions
npx supabase functions deploy create-paypal-subscription
npx supabase functions deploy cancel-paypal-subscription
npx supabase functions deploy paypal-webhook
npx supabase functions deploy reconcile-paypal-subscriptions
npx supabase functions deploy manage-paypal-catalog

# Configurar secrets
npx supabase secrets set \
  BILLING_ENABLED=true \
  PAYPAL_ENABLED=true \
  PAYPAL_MODE=sandbox \
  PAYPAL_CLIENT_ID=<YOUR_CLIENT_ID> \
  PAYPAL_CLIENT_SECRET=<YOUR_CLIENT_SECRET> \
  PAYPAL_WEBHOOK_ID=<YOUR_WEBHOOK_ID> \
  PAYPAL_API_BASE=https://api-m.sandbox.paypal.com \
  PUBLIC_SITE_URL=https://weaf.vercel.app \
  --project-ref vwxqewpvtucygbaethkv
```

## Panel administrativo

### Planes y ofertas

El administrador global puede:

- Ver planes Normal y Plus con precios base
- Crear ofertas con descuento porcentaje, monto fijo o precio personalizado
- Configurar ventanas de adquisición y duración del beneficio
- Establecer límite de suscripciones y restricción de nuevos clientes
- Definir comportamiento al finalizar (expirar, mismo precio, precio base)
- Guardar como borrador, programar, activar, retirar
- Sincronizar con PayPal
- Duplicar ofertas existentes
- Ver cantidad de suscriptores y errores de sincronización

### Validaciones

- No se permite modificar destructivamente un plan con suscriptores
- Los precios siempre se obtienen del servidor, nunca del navegador
- Las ofertas requieren sync con PayPal antes de activarse
- Todas las operaciones administrativas quedan registradas en `billing_audit_log`

## Reconciliación

La función `reconcile-paypal-subscriptions` se ejecuta periódicamente:

1. Obtiene suscripciones pendientes de reconciliación
2. Consulta el estado actual en PayPal
3. Actualiza estados locales si difieren
4. Registra inconsistencias para investigación

Ejecución manual:

```powershell
curl.exe -X POST "https://vwxqewpvtucygbaethkv.supabase.co/functions/v1/reconcile-paypal-subscriptions" `
  -H "apikey: $env:SUPABASE_SECRET_KEY" `
  -H "Content-Type: application/json" `
  -d '{"limit": 25}'
```

## Cancelación

1. El usuario solicita cancelación desde `/account/billing`
2. Se verifica propiedad y estado
3. Se envía cancelación a PayPal REST
4. Se marca como `cancellation_pending` en la base
5. La ficha se oculta inmediatamente
6. El webhook confirma la cancelación final

## Visibilidad después de cancelar

W.E.A.F retira una publicación de la zona pública cuando:

- `BILLING.SUBSCRIPTION.CANCELLED`: estado `canceled`, sin featured
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`: estado `paused`, sin featured
- `BILLING.SUBSCRIPTION.SUSPENDED`: estado `paused`, sin featured
- `BILLING.SUBSCRIPTION.EXPIRED`: estado `expired`, sin featured
- `PAYMENT.SALE.REFUNDED`: pago `refunded`, sin featured
- `PAYMENT.SALE.REVERSED`: pago `reversed`, sin featured

La protección existe en dos capas:
1. Trigger `enforce_server_listing_visibility` normaliza el estado
2. Políticas RLS y consultas públicas solo exponen publicaciones activas con pago confirmado

## Modo degradado

Con `VITE_BILLING_ENABLED=false` o `VITE_PAYPAL_ENABLED=false`, el frontend guarda la ficha pero no llama a la suscripción. La publicación permanece no pública hasta que un administrador la active manualmente.

## Pruebas

### Sandbox de PayPal

1. Crea cuentas de prueba en [developer.paypal.com](https://developer.paypal.com/dashboard/)
2. Usa las credenciales Sandbox en los secrets
3. Al aprobar en Sandbox no se cobran reales

### Verificar

1. Usuario A no puede iniciar Checkout para ficha de usuario B
2. Redirección a `/servers/success` permanece pendiente hasta el webhook
3. `PAYMENT.SALE.COMPLETED` activa la ficha y Plus queda destacado
4. Reenviar el mismo evento no duplica suscripción ni pagos
5. `PAYMENT.FAILED` pausa y oculta la ficha
6. Cancelar oculta la ficha inmediatamente
7. La reconciliación corrige estados desincronizados

## Rollback

Para volver a Stripe temporalmente:

1. Desactiva `PAYPAL_ENABLED` en secrets de Supabase
2. Activa `STRIPE_ENABLED` en secrets de Supabase
3. Activa `VITE_STRIPE_ENABLED=true` en Vercel
4. Los datos históricos de Stripe permanecen intactos
5. La columna `billing_source` distingue entre `stripe`, `paypal` y `manual`

## Diferencias con la implementación anterior de Stripe

| Aspecto | Stripe (antes) | PayPal (ahora) |
|---------|---------------|----------------|
| Checkout | Redirect a Stripe Hosted | Redirect a PayPal Approval URL |
| Portal de facturación | Stripe Billing Portal | Sección propia en W.E.A.F |
| Webhook verification | `stripe listen` secret | Verificación oficial de firma |
| Planos hardcodeados | Sí ($3, $7 en frontend) | No, desde base de datos |
| Ofertas admin | No existían | CRUD completo con versiones |
| Reconciliación | Básica | Batch con límites y alertas |
| Cancelación | Via Stripe Portal | Via API REST + webhook |
| Historial de eventos | `private.stripe_events` | `private.billing_events` |
| Auditoría admin | No existía | `private.billing_audit_log` |
