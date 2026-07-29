# Checklist de despliegue seguro

Este documento registra el despliegue controlado ejecutado el 2026-07-28 (Costa Rica) / 2026-07-29
(UTC). No autoriza PayPal Live, merge ni cambios destructivos. El PR continúa como Draft y los dos
interruptores de pagos permanecen apagados.

## Estado del despliegue controlado

- [x] Docker Desktop 4.84.0 operativo; `docker version` mostró Client y Server.
- [x] Backups nuevos, externos al repo y mayores que 0 en `E:\W.E.A.F-Backups\20260728-220144`.
- [x] Historial local/remoto comparado y dry-run limitado a cuatro migraciones.
- [x] Cuatro migraciones aplicadas en orden; historial local/remoto alineado.
- [x] Ocho Edge Functions desplegadas con el `verify_jwt` esperado.
- [x] `check`, 130 unitarias, 20 E2E, build y audit de dependencias en verde.
- [x] Prueba A/B de ownership y RLS con usuarios sintéticos; datos privados aislados.
- [ ] QA visual del Preview y flujo Admin con sesión segura; Vercel Authentication bloqueó la
  inspección anónima del Preview.
- [ ] Matriz PayPal completa en Sandbox. No se ejecutaron pagos ni se habilitaron switches.

## 1. Antes de desplegar

- Revisar el PR y confirmar que el entorno objetivo es desarrollo o staging.
- Mantener `PAYPAL_MODE=sandbox` y comprobar que ninguna credencial Live esté configurada.
- Respaldar el esquema y las tablas de billing/marketplace antes de aplicar migraciones.
- Corregir el BOM de `.env.local` guardándolo como UTF-8 sin BOM. No imprimir ni copiar sus valores.
- Repetir:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Antes del push el historial estaba alineado hasta `20260723230000_paypal_security_audit_fixes.sql`.
Después del push quedó alineado hasta `20260729012207_marketplace_paypal_orders.sql`. No se usó
`migration repair`, `db reset` ni se borró historial.

## 2. Migraciones nuevas, en orden

1. `20260729003759_phase_1_security_hardening.sql`
2. `20260729004321_paypal_kill_switch.sql`
3. `20260729010939_phase_7_marketplace_foundation.sql`
4. `20260729012207_marketplace_paypal_orders.sql`

El dry-run mostró exactamente estas cuatro migraciones y luego se ejecutó:

```powershell
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db lint --linked
```

El push terminó correctamente. La migración de marketplace creó el cron `*/15 * * * *`; se verificó
que apunta a `expire_marketplace_listings()` y que el procedimiento es idempotente.

## 3. Edge Functions desplegadas

```powershell
npx supabase functions deploy create-paypal-subscription --project-ref vwxqewpvtucygbaethkv
npx supabase functions deploy cancel-paypal-subscription --project-ref vwxqewpvtucygbaethkv
npx supabase functions deploy reconcile-paypal-subscriptions --project-ref vwxqewpvtucygbaethkv
npx supabase functions deploy paypal-webhook --project-ref vwxqewpvtucygbaethkv
npx supabase functions deploy create-marketplace-paypal-order --project-ref vwxqewpvtucygbaethkv
npx supabase functions deploy capture-marketplace-paypal-order --project-ref vwxqewpvtucygbaethkv
```

También se desplegaron `track-server-event` y `manage-paypal-catalog`. Versiones resultantes:
tracking v22, catálogo v5, crear/cancelar suscripción v5, reconciliación v3, webhook v3 y las dos
funciones marketplace v1.

No desplegar funciones de checkout antes de las migraciones. `paypal-webhook` y reconciliación
deben continuar funcionando aunque el kill switch de nuevos pagos esté apagado.

## 4. Secrets y variables

No hay secretos nuevos. Verificar por nombre, nunca por valor:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_MODE=sandbox`
- `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`
- `PAYPAL_ENABLED=true`
- `BILLING_ENABLED=true`
- `PUBLIC_SITE_URL` apuntando al entorno probado

En Vercel, conservar únicamente claves públicas `VITE_*`. No exponer service role ni secretos PayPal.

## 5. PayPal Sandbox manual

En el webhook Sandbox habilitar:

- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`
- `PAYMENT.SALE.REVERSED`
- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`

Desde Admin, mantener pagos destacados apagados hasta definir
`marketplace_featured_price_minor`. Probar gratis primero; luego fijar un precio de prueba,
habilitar Sandbox y recorrer una única orden con cuenta Sandbox.

## 6. Smoke tests obligatorios

- Registro/login/logout e inactividad de cuatro horas.
- Dos usuarios: A no puede leer/editar tribus, servidores o anuncios privados de B.
- Servidor Normal: pago, webhook, activo y `is_featured=false`.
- Servidor Plus: pago, webhook, activo y `is_featured=true`.
- Cancelación, suspensión, fallo, expiración, refund y reversal retiran visibilidad/beneficio.
- Marketplace gratuito expira exactamente a siete días y desaparece del catálogo.
- Pago marketplace solo se destaca tras webhook verificado, nunca por return/capture del navegador.
- Replay del mismo evento no duplica pagos ni extiende expiración.
- `/robots.txt` devuelve texto y `/sitemap.xml` XML, no el shell SPA.
- Auth, Admin, cuenta, success/cancel y checkout llevan `noindex`.

## 7. Rollback

1. Confirmar que `paypal_payments=false` y `marketplace_payments=false` en configuración server-side.
2. Mantener webhooks y reconciliación para obligaciones existentes.
3. Revertir el frontend/Edge Functions a la versión anterior mediante deployment, sin borrar tablas.
4. Preservar billing, eventos, pagos, reportes y auditoría.
5. Si el esquema requiere reversión, preparar una migración nueva revisada y respaldada; nunca editar
   migraciones ya aplicadas ni ejecutar `DROP` ad hoc.
