# Fase 7 - Stripe y vigencia de publicaciones

La Fase 7 conecta el directorio de servidores con Stripe Checkout mediante dos Edge Functions y una conciliación idempotente en Postgres.

## Flujo

1. Un usuario autenticado elige Normal ($3 USD/mes) o Plus ($7 USD/mes).
2. `create-server-checkout` crea la sesión alojada por Stripe. El importe y los metadatos salen del plan guardado en Postgres, nunca del navegador.
3. Stripe llama a `stripe-webhook`. La función lee el cuerpo sin transformarlo, verifica `Stripe-Signature` y solo entonces procesa el evento.
4. `process_stripe_server_event` registra el ID del evento, evita procesarlo dos veces y activa la suscripción.
5. El usuario completa la ficha. La suscripción solo puede consumirse una vez y queda enlazada a la publicación.
6. Renovaciones actualizan `expires_at`; una tarea `pg_cron` horaria expira publicaciones cuyo periodo terminó.

## Eventos admitidos

- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Los demás eventos firmados se registran como procesados sin mutar pagos o publicaciones.

## Secretos necesarios

Configurar en Supabase Edge Functions, nunca como variables `VITE_`:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
PUBLIC_SITE_URL
```

El endpoint del webhook es `https://vwxqewpvtucygbaethkv.supabase.co/functions/v1/stripe-webhook`. En Stripe deben seleccionarse los cuatro eventos anteriores.

## Estado operativo

El código y las funciones están desplegados. Checkout responde de forma segura con `payments_not_configured` hasta que existan las claves privadas reales. El flag `stripe_payments` permanece desactivado hasta completar esa configuración.
