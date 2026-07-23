# Fase 11 - QA completo de Stripe

Stripe permanece en modo test. No se cambiaron claves, Prices, webhooks ni flags de producción.

## Revisión de implementación

| Flujo | Protección verificada en código |
| --- | --- |
| Crear Checkout | POST autenticado, límite de payload, plan `normal/plus`, propiedad del listing, rate limit, Customer reutilizable y Price desde secrets. |
| Activar listing | Solo el webhook firmado reconcilia el pago; la página success no activa la ficha. |
| Normal | Price Normal, `is_featured=false` y acceso público solo con estado activo/pago válido. |
| Plus | Price Plus, `is_featured=true` solo mientras la suscripción está activa o en trial. |
| Portal | POST autenticado, Customer del usuario y retorno a `/account/billing`. |
| Cancelación | `updated` con `cancel_at_period_end` o `deleted` cancela y retira el destacado; el trigger falla cerrado. |
| Fallo de pago | `invoice.payment_failed` deja `paused/failed` y `is_featured=false`. |
| Expiración | Endpoint secreto y RPC que no expira una suscripción Stripe con periodo vigente. |
| Idempotencia | `private.stripe_events.id` evita procesar dos veces el mismo evento. |

## Prueba Normal

- [ ] Crear `/servers/publish?plan=normal` con un usuario QA.
- [ ] Confirmar que el draft es propiedad de ese usuario y queda `pending_payment/pending`.
- [ ] Abrir Checkout y confirmar USD 3/mes en modo test.
- [ ] Pagar con una tarjeta de prueba y esperar `checkout.session.completed`.
- [ ] Confirmar `active/paid`, `plan=normal`, `is_featured=false`.
- [ ] Verificar que aparece en `/servers` y no en placements Plus.

## Prueba Plus

- [ ] Repetir con `/servers/publish?plan=plus` y USD 7/mes.
- [ ] Confirmar `active/paid`, `plan=plus`, `is_featured=true`.
- [ ] Verificar prioridad en `/servers` y aparición en placements internos habilitados.
- [ ] Sin consentimiento de medición, confirmar que la UI funciona y no envía tracking.

## Cancelación y fallo

- [ ] Abrir Billing Portal desde `/account/billing` y cancelar la suscripción QA.
- [ ] Confirmar webhook `customer.subscription.updated` o `deleted` con HTTP 200.
- [ ] Confirmar que la ficha queda cancelada, sin destacado y fuera de directorio/promociones.
- [ ] Reactivar solo para QA y confirmar que `active` con `cancel_at_period_end=false` la restaura.
- [ ] Usar Stripe test clocks o una tarjeta de fallo documentada para producir `invoice.payment_failed`.
- [ ] Confirmar `paused/failed`, `is_featured=false` y ausencia pública.
- [ ] Reenviar un evento y comprobar que no duplica pagos ni suscripciones.

## Pasos manuales en Stripe Dashboard

- [ ] Mantener el Dashboard en **Test mode**.
- [ ] Confirmar que los Prices recurrentes son Normal USD 3/mes y Plus USD 7/mes.
- [ ] Confirmar que el endpoint apunta a `.../functions/v1/stripe-webhook`.
- [ ] Confirmar eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- [ ] Revisar entregas, reintentos y firma del endpoint tras cada caso.
- [ ] Configurar el Customer Portal para cancelación y revisar su texto de retorno.
- [ ] No copiar `sk_test`, `sk_live` ni `whsec` a Vercel o al repositorio.
- [ ] No activar Live mode hasta cerrar QA, legal, reembolsos, impuestos y soporte.
