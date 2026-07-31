# Marketplace PayPal — Reconciliación de capturas completadas vía API

## Problema

Un pago Sandbox puede quedar `approved` en `marketplace_payments` con
`paypal_capture_id` ya presente y, sin embargo, **nunca llegar el webhook**
`PAYMENT.CAPTURE.COMPLETED`. En la validación real se observó:

- Pago `approved`, 300 USD, con order y capture id presentes.
- `capture_response_received` con `paypal_status = COMPLETED`.
- Cero invocaciones a `paypal-webhook` en la ventana (NO DELIVERY).
- `paid_at = null`, `is_featured = false`, slots de featured vacíos.

El flujo anterior de `capture-marketplace-paypal-order` solo hacía POST de captura
y dejaba el pago en `pending_confirmation` esperando el webhook que no llegaba.
El beneficio (7 días destacado) nunca se activaba.

## Solución

La Edge Function `capture-marketplace-paypal-order` ahora reconcilia la captura
leyéndola de vuelta desde PayPal (orquestado en `_shared/paypalCaptureFlow.ts`):

- **Flujo A (capture id ya conocido):** si `prepare_marketplace_paypal_capture`
  devuelve `paypal_capture_id`, se hace `GET /v2/payments/captures/{capture_id}`
  (nunca POST). Si `status = COMPLETED`, el monto es `3.00`/USD y
  `supplementary_data.related_ids.order_id` coincide con el `paypal_order_id`,
  se confirma vía RPC. Si sigue `PENDING`, se devuelve `pending_confirmation`
  sin re-registrar.
- **Flujo B (capture id desconocido):** POST de captura **una sola vez** con
  `requestId = <idempotency_key>-capture`. Si `COMPLETED` → confirmación
  inmediata; si `PENDING` → `record_marketplace_capture_response` y
  `pending_confirmation`; si falta capture id o el monto no coincide →
  `marketplace_capture_reconciliation_failed`.
- **Flujo C (confirmado):** respuesta `{ status: "confirmed", listing_id, reused }`
  al frontend, **sin exponer IDs de PayPal**.

### RPC `public.confirm_marketplace_paypal_capture_from_api(p_payment_id, p_user_id, p_order_id, p_capture_id, p_amount_minor, p_currency, p_captured_at)`

- `SECURITY DEFINER`, `search_path = ''`, revocada de `public`/`anon`/`authenticated`,
  concedida solo a `service_role`.
- Guards: `payment` del usuario; `environment = 'sandbox'`; `amount_minor = 300` y
  `currency = 'USD'` (fila y parámetros); `p_order_id` exacto contra
  `paypal_order_id`; capture id nuevo o idéntico; `status in (created, approved)`;
  `paid_at is null`; listing del usuario, `game = 'ascended'`, `status = 'active'`,
  `is_featured = false`.
- Efectos: `status = 'captured'`, `paypal_capture_id = p_capture_id`,
  `paid_at = p_captured_at`; listing `is_featured = true`,
  `featured_started_at = p_captured_at`,
  `featured_expires_at = p_captured_at + 7 días`,
  `expires_at = greatest(expires_at, p_captured_at + 7 días)`.
- Auditoría: `capture_confirmed_from_api` y `featured_activated` con
  `{ duration_days: 7, amount_minor: 300, currency: 'USD', environment: 'sandbox',
  confirmation_source: 'paypal_api' }` (sin IDs PayPal ni secretos).
- Idempotencia: un replay del mismo order+capture con pago ya `captured` y listing
  ya destacado devuelve `{ confirmed: true, reused: true }` sin tocar fechas ni
  duplicar auditoría. Order/capture distintos →
  `marketplace_capture_reconciliation_failed`; `failed`/`refunded`/`reversed` →
  `marketplace_payment_not_available`.

### `process_marketplace_paypal_event` (webhook tardío)

- Webhook `PAYMENT.CAPTURE.COMPLETED` tardío con **el mismo** capture id sobre un
  pago ya confirmado vía API: se registra el billing event como procesado, se
  devuelve `true` y **no se re-activa** el beneficio ni se duplica auditoría.
- Capture id distinto sobre pago `captured`:
  `processing_error = 'marketplace_capture_reconciliation_failed'` en
  `private.billing_events` y la excepción se propaga.
- `refunded`/`reversed` siguen retirando el destacado igual que antes.

## Procedimiento para el pago remoto actual (post-merge/deploy)

Tras aplicar la migración y desplegar la Edge Function:

1. Re-verificar el pago: `status = 'approved'`, `amount_minor = 300`,
   `currency = 'USD'`, `paypal_capture_id` presente, `paid_at = null`,
   `is_featured = false`, cero `featured_activated`, switches sin cambios.
2. Llamar **una única vez** a `capture-marketplace-paypal-order` con el
   `payment_id` del pago. El flujo A hará el GET (nunca POST) y confirmará.
3. Verificar: `status = 'captured'`, `paid_at` fijado, listing
   `is_featured = true` con ventana de 7 días, dos filas de auditoría
   (`capture_confirmed_from_api` + `featured_activated`), y `featured_expires_at`.
4. Si el GET responde `PENDING`, no tocar; reintentar más tarde.

Prohibido: POST de captura manual, `UPDATE` manual del pago como solución
permanente, fabricar event IDs o `migration repair`.

## Rollback

Migración compensatoria que restaure la versión anterior de
`prepare_marketplace_paypal_capture`, `process_marketplace_paypal_event` y elimine
`confirm_marketplace_paypal_capture_from_api` (con grants revertidos), manteniendo
datos. Kill switches (`paypal_payments = false`, `payments_enabled = false`)
detienen el flujo en segundos sin deploy.

## Validación

- SQL: `supabase/tests/marketplace-capture-api-reconciliation.sql` (19 casos:
  preparación ampliada, confirmación feliz con activación del beneficio, replay
  idempotente, orden/capture/ownership/estado/monto/currency/ASA/listing/featured
  fallidos, grants, webhook tardío duplicado y mismatch).
- Unitarias: `tests/marketplace-paypal-capture-reconciliation.test.js` (16 tests:
  flujos A/B/C con mocks; GET cuando hay capture id, POST una sola vez, confirm
  inmediato, PENDING, errores de monto/order, errores de RPC y propagación de
  errores; 232 totales con la suite; sin llamadas reales a PayPal).
- `supabase db reset`, `supabase db lint --local --level warning` (solo el warning
  preexistente de Stripe), `npm run check`, `npm run test:unit`,
  `npm run test:e2e:ci`, `npm run build`, `npm run check:budget`,
  `npm audit` (0 vulnerabilidades).
