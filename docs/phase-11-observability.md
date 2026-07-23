# Fase 11 - Observabilidad operativa

No se añade Sentry en esta fase. La base operativa usa logs de Supabase, Vercel, Stripe Dashboard y pruebas sintéticas.

## Corte observado

En la muestra de las 100 ejecuciones Edge más recientes hubo 80 respuestas 200 de `track-server-event`, 3 del webhook y 2 del portal. Los 14 errores 500 de tracking ocurrieron antes del hotfix; después del despliegue aparecen respuestas 200. Existe un 400 posterior que debe tratarse como entrada rechazada y observarse si se repite.

Postgres conserva los 14 `service_role_required` asociados a esos fallos previos. El cron de expiración ejecutó correctamente. No se encontraron errores recientes del webhook en la muestra.

La integración de Vercel disponible durante esta revisión no mostró el proyecto W.E.A.F, por lo que los runtime logs de Vercel quedan como verificación manual obligatoria.

## Rutina de revisión

- Diario durante lanzamiento: Edge Functions, Auth y Postgres en Supabase; Functions/Runtime en Vercel; entregas en Stripe.
- Semanal: Advisor de seguridad y rendimiento, cron de expiración, errores 4xx/5xx por función y webhooks pendientes.
- Tras cada deploy: smoke de rutas, consola del navegador y una operación de lectura autenticada.

## Eventos críticos

- `stripe_event_reconciliation_failed` o webhook 5xx.
- Checkout 5xx, aumento de `checkout_rate_limit` o mismatch de propiedad.
- `invoice.payment_failed`, suscripciones `past_due/unpaid` y cancelaciones.
- Auth signup/login/reset 4xx anómalos, especialmente `email_not_confirmed`.
- `service_role_required` posterior al hotfix.
- Cron de expiración ausente o fallido.
- Errores JS que impidan login, publicar o abrir Billing Portal.

## Evolución futura

- Diseñar `client_error_logs` con muestreo, rate limit, redacción de PII, retención corta y consentimiento aplicable.
- Crear alerta para webhook Stripe con 5xx o eventos sin procesar, sin guardar cuerpos sensibles en la alerta.
- Dar acceso de solo lectura al proyecto Vercel para automatizar consulta de logs.
- Definir SLO básicos antes de incorporar una plataforma externa de errores.
