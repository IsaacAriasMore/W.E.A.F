# Marketplace PayPal — Recovery del 502 `paypal_approval_url_missing`

## Causa del 502

Durante la validación Sandbox (QA) de `create-marketplace-paypal-order` (v3), el
log interno registró:

```
create_marketplace_paypal_order_failed paypal_approval_url_missing
POST | 502
```

`prepare_marketplace_paypal_order` terminó correctamente (fila insertada,
auditoría `paypal_order_prepared`), pero la respuesta de `POST /v2/checkout/orders`
no produjo una URL de aprobación. El helper `approvalUrl()` solo reconocía
`rel === 'approve'`. PayPal Orders v2 puede devolver el enlace HATEOAS con
`rel = 'payer-action'` (especialmente con `status = 'PAYER_ACTION_REQUIRED'`).
Al no reconocerlo, la URL quedaba vacía y se lanzaba `paypal_approval_url_missing`
(502) antes de adjuntar la orden.

La sub-causa exacta (respuesta 2xx sin `id`/link aprovechable) no quedó registrada
porque la función no logueaba el cuerpo; el fix estructural no depende de ello.

## Soporte para `payer-action` y `approve`

`supabase/functions/_shared/paypal.ts` → `approvalUrl()` ahora:

1. Prefiere `rel = 'payer-action'` cuando existe.
2. Cae a `rel = 'approve'` como respaldo.
3. Exige que el enlace tenga `href` (ignora `self`, `capture`, `authorize` y
   enlaces sin `href`).
4. Devuelve `''` si no hay ningún enlace permitido.

La validación Sandbox existente (`PAYPAL_MODE !== "sandbox"`, base
`https://api-m.sandbox.paypal.com`) permanece intacta.

## Defecto del pago `created` bloqueado

`prepare_marketplace_paypal_order` inserta la fila **antes** de llamar a PayPal.
Si la creación falla antes de obtener un `order_id`, la fila queda
`status = 'created'`, `paypal_order_id = null`, `paypal_capture_id = null`,
`paid_at = null`. `marketplace_payment_in_progress` (created/approved/captured)
bloquea un nuevo intento para ese anuncio → pago muerto que impide reintentar.

## Mecanismo de recuperación

### Edge Function (`create-marketplace-paypal-order`)

Nuevo flujo `create → attach → URL` (orquestado en
`_shared/paypalOrderFlow.ts`):

1. Validar `created.id`; si falta → error `paypal_approval_url_missing`.
2. Guardar `created.id` en `remotePayPalOrderId`.
3. Adjuntar la orden con `attach_marketplace_paypal_order`.
4. Obtener URL con `approvalUrl` (acepta `payer-action` y `approve`).
5. Devolver la URL.

- **Sin `order_id`** (fallo OAuth/red/API o respuesta sin `id`): el `catch`
  llama `fail_marketplace_paypal_order_creation` → la preparación local pasa a
  `failed` y el anuncio puede reintentarse con otra idempotency key.
- **Con `order_id` y fallo de `attach`** (incertidumbre de reconciliación): no se
  marca `failed`; se conserva el registro y se devuelve
  `marketplace_order_reconciliation_failed`.
- **Con `order_id` pero sin URL**: el ID queda adjuntado; un reintento con la
  misma idempotency key consulta la orden existente y recupera su enlace.

Logs sanitizados: `create_marketplace_paypal_order_failed <code> <status>` y, solo
para `paypal_approval_url_missing`, un objeto con `order_id_present`, `status` y
`link_rels` (sin `href`, sin IDs, sin secretos).

### RPC `public.fail_marketplace_paypal_order_creation(p_payment_id, p_user_id, p_reason)`

- `SECURITY DEFINER`, `search_path = ''`, revocada de `public`/`anon`/`authenticated`,
  concedida solo a `service_role`.
- Pasa a `failed` únicamente cuando: `status = 'created'`, `paypal_order_id is null`,
  `paypal_capture_id is null`, `paid_at is null`, y `user_id` coincide.
- Devuelve `boolean` (true = cerró, false = no aplicaba; segunda llamada = false).
- Auditoría `paypal_order_creation_failed` con `reason` (sanitizada, ≤ 80), `environment`,
  `previous_status`. No guarda cuerpos PayPal, URLs, IDs externos, credenciales, tokens,
  encabezados ni datos personales. No usa DELETE.

## Procedimiento para el pago remoto actual

Tras merge del PR, aplicar la migración y desplegar la Edge Function, se ejecutará
**una única llamada controlada** (service_role) a
`fail_marketplace_paypal_order_creation` para cerrar el pago `created` actual.
Re-verificar antes: `status = 'created'`, `paypal_order_id = null`,
`paypal_capture_id = null`, `paid_at = null`, cero billing events relacionados,
cero `featured_activated`, anuncio no destacado.

Prohibido: `DELETE` del pago, `UPDATE` manual como solución permanente y
`migration repair`.

## Rollback

Migración compensatoria que reemplace la RPC por su versión anterior (o la retire
con `drop function`) y revierta los grants, manteniendo datos. Kill switches
(`paypal_payments = false`, `payments_enabled = false`) detienen el flujo en
segundos sin deploy. Nunca usar `migration repair` como rollback de esquema.

## Validación

- SQL: `supabase/tests/marketplace-paypal-order-creation-recovery.sql` (14 casos:
  cierre de `created` sin orden, protecciones approved/captured/order/capture/paid_at,
  ownership, grants anon/authenticated/service_role, auditoría sin secretos,
  idempotencia, reintento tras `failed`).
- Unitarias: `tests/marketplace-paypal-recovery.test.js` (`approvalUrl` y flujo de
  creación con mocks; sin llamadas reales a PayPal).
- `supabase db reset`, `supabase db lint --local --level warning` (solo el warning
  preexistente de Stripe), `npm run check`, `npm run test:unit`, `npm run test:e2e:ci`,
  `npm run build`, `npm run check:budget`, `npm audit`.
