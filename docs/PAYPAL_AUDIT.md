# Auditoría PayPal Sandbox

Fecha: 2026-07-28. PayPal permanece bloqueado a Sandbox en código y configuración. Esta auditoría
no activa Live, no contiene credenciales y no ejecuta cargos reales.

## Arquitectura auditada

```text
Browser -> save draft RPC -> create-paypal-subscription -> PayPal approval
                                                     |
PayPal signed webhook -> process_paypal_billing_event -> entitlement/listing/payment
                                                     |
Secret worker -> reconcile-paypal-subscriptions -----+
```

La URL `/servers/success` solo consulta estado; no activa publicaciones. El precio y el PayPal Plan
ID salen de `billing_plan_versions`, nunca del body del navegador.

## Catálogo y checkout

- `billing_products`, `billing_plans`, `billing_plan_versions` y `billing_offers` separan concepto,
  versión inmutable y ventana comercial.
- Normal conserva USD 3/mes y Plus USD 7/mes. Ofertas exigen versión Sandbox sincronizada y plan
  PayPal `ACTIVE`.
- `prepare_paypal_subscription` bloquea listing ajeno/manual, plan inactivo, oferta fuera de fecha,
  cupo reservado agotado, cliente no nuevo y una segunda suscripción abierta.
- La clave UUID de idempotencia es única en DB y se reutiliza como `PayPal-Request-Id`.
- URLs return/cancel se construyen con `PUBLIC_SITE_URL`; la URL de aprobación debe venir del link
  `approve` de PayPal.

## Kill switch corregido

`paypal_payments` es ahora autoritativo en tres capas:

1. La UI consulta `get_paypal_checkout_status()` y muestra un mensaje ES/EN.
2. `create-paypal-subscription` consulta la flag con `service_role` antes de preparar nada.
3. Un trigger `BEFORE INSERT` rechaza cualquier nueva fila PayPal con `billing_disabled`.

Apagar la flag no interrumpe webhooks, reconciliación, consulta de cuenta ni cancelación de
suscripciones existentes. Las variables privadas `BILLING_ENABLED`, `PAYPAL_ENABLED` y
`PAYPAL_MODE=sandbox` siguen siendo un segundo corte operacional.

## Webhook

- Endpoint sin JWT por diseño; verifica firma mediante el endpoint oficial y `PAYPAL_WEBHOOK_ID`.
- Límite de 1 MiB, JSON válido, ID/tipo y allowlist de diez eventos.
- Incluso un evento desconocido debe superar firma antes de recibir 200/ignored.
- `private.billing_events` conserva el evento original fuera del esquema expuesto y aplica unicidad
  por proveedor/entorno/event ID.
- `process_paypal_billing_event` usa timestamp del proveedor, rechaza regresiones de eventos fuera
  de orden y asocia por subscription, payment o `custom_id` para cubrir la carrera create/attach.

| Evento | Resultado esperado |
| --- | --- |
| CREATED | `approval_pending`; no publica. |
| ACTIVATED / UPDATED | Sincroniza suscripción; no sustituye el pago como prueba de entitlement. |
| PAYMENT.SALE.COMPLETED | Inserta un pago una vez, activa listing; featured solo si Plus. |
| PAYMENT.FAILED | Pausa listing, quita featured y registra motivo. |
| SUSPENDED | Pausa y quita featured. |
| CANCELLED | Conserva periodo pagado si existe; sin renovación ni promoción Plus. |
| EXPIRED | Expira/oculta y cancela entitlement. |
| REFUNDED | Marca refund, cancela listing y elimina beneficio. |
| REVERSED | Marca reversal, pausa listing y elimina beneficio. |

## Reconciliación

- `reconcile-paypal-subscriptions` exige secreto de Supabase, limita el body y normaliza lote 1–50.
- Consulta PayPal por subscription ID, actualiza `last_reconciled_at`, reinicia/incrementa
  `reconciliation_failures` y devuelve alertas sin secretos.
- La reconciliación no crea pagos ni inventa cobros. Corrige estado remoto y oculta estados no
  activos. Se mantiene disponible aunque `paypal_payments=false`.

## Correcciones de interfaz

- `/servers/success` prioriza `next_billing_time` y `current_period_end` de la suscripción; solo usa
  fechas del listing como fallback y nunca ejecuta `new Date(null)`.
- Renovables muestran “próximo cobro”; duración fija muestra “vigente hasta”; sin fecha muestra un
  estado claro.
- Cancelación ya no promete ocultar inmediatamente el periodo pagado; explica que detiene renovación
  y retira promoción Plus.
- `cancellation_pending` no ofrece un segundo botón de cancelación.
- Todos los textos nuevos existen en español e inglés.

## Stripe legacy

Se conservan tablas, columnas, migraciones y cuatro Edge Functions Stripe para historia/rollback.
`src/config/billing.js` fuerza el flujo visible Stripe a `false`; no se muestran claves ni CTA Stripe.
No se elimina código hasta validar una política de retención, respaldo, ausencia de suscripciones
legacy vivas y un rollback alternativo.

## Pruebas

- Unitarias: kill switch triple, eventos, fecha segura, retorno no autoritativo y Sandbox lock.
- SQL estático previo: idempotencia, orden de eventos, ownership y grants service-only ya están
  cubiertos por las pruebas de billing existentes y la migración de hardening aplicada.
- Pendiente manual Sandbox: Plus, cancelación, failed, suspended, expired, refund, reversal y una
  ejecución real del reconciliador. No se simularon cambios sobre pagos reales.

## Riesgos residuales

- PayPal puede entregar eventos con variantes de payload; conservar alerta de
  `subscription_not_found` y reconciliar.
- El cron del reconciliador debe configurarse con secreto fuera del repo y observar duración/límites.
- Refund/reversal requieren acciones Sandbox y confirmación en Dashboard; no deben probarse sobre
  la suscripción de un usuario real.
- El dry-run y el push controlado se completaron después de crear backups externos válidos; el historial
  local/remoto quedó alineado. PayPal continúa en Sandbox y `paypal_payments=false`.

## Hotfix del checkout destacado Marketplace

`create-marketplace-paypal-order` y la función SQL autoritativa ahora requieren a la vez:

1. `feature_flags.paypal_payments=true`;
2. `marketplace_settings.payments_enabled=true`;
3. precio positivo y no nulo;
4. `marketplace_settings.environment='sandbox'`;
5. `PAYPAL_MODE=sandbox`;
6. `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`.

La migración bloquea antes de insertar en `marketplace_payments`; el Edge devuelve un error controlado
cuando billing o Marketplace están apagados. Tras el despliegue ambos switches siguen `false`, el
entorno sigue Sandbox y la tabla conserva 0 pagos. No se invocó la API de Orders ni se ejecutó ningún
evento financiero. Para rollback, redesplegar la Edge anterior y restaurar la función SQL mediante
una migración compensatoria; nunca debilitar el flag global.
