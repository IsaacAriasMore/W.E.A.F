# Marketplace de recursos W.E.A.F

## Alcance

El marketplace es un tablón comunitario para comprar, vender o intercambiar recursos dentro de ARK ASE/ASA. W.E.A.F no procesa pagos entre comprador y vendedor, no actúa como escrow y no garantiza el intercambio. El contacto ocurre mediante una invitación HTTPS de Discord.

## Plan gratuito

- Requiere cuenta y aceptación explícita de reglas.
- Publicación inmediata durante exactamente siete días.
- Máximo de cinco anuncios activos/borradores/pagos pendientes por usuario y cinco creaciones por 24 horas.
- El usuario puede editar mientras el anuncio siga activo y no vencido, u ocultarlo.
- Un job de `pg_cron` ejecuta `expire_marketplace_listings()` cada 15 minutos. La operación es idempotente y elimina `is_featured`.
- La expiración, el estado y `is_featured` se fijan en funciones server-side; el navegador no puede enviarlos.

## Contenido y seguridad

Las validaciones existen en frontend, constraints SQL y RPCs. Se prohíben HTML, credenciales, contraseñas, tokens, cuentas robadas, cheats, exploits, datos sensibles, fraude y enlaces maliciosos. Discord admite únicamente `https://discord.gg/...` o `https://discord.com/invite/...`; la imagen opcional debe ser HTTPS.

Las tablas tienen RLS. No se concede escritura directa a `anon` o `authenticated`: crear, editar, ocultar, reportar y moderar pasa por funciones `SECURITY DEFINER` con `search_path=''`, ownership o rol global comprobado. El catálogo público se entrega por una RPC que selecciona únicamente anuncios `active` y no expirados, sin exponer `owner_user_id`.

## Estados

`draft`, `pending_payment`, `active`, `expired`, `hidden`, `rejected`, `removed`, `payment_failed`, `refunded` y `reversed`.

No se hace hard delete automático. Anuncios, pagos, reportes y auditoría quedan retenidos para fraude, disputas y revisión. Antes de purgar debe aprobarse una política de retención y anonimización.

## Destacado

La configuración `featured_listing` guarda `price_minor`, moneda, entorno y kill switch. Su estado inicial es:

- `marketplace_enabled=true`;
- `payments_enabled=false`;
- `price_minor=null`;
- `currency=USD`;
- `environment=sandbox` (constraint estricto).

Mientras no exista precio o pagos estén desactivados, el plan gratuito funciona y la UI explica que Destacado no está disponible. El precio comercial no se inventa.

PayPal Destacado se implementa con Orders v2 como pago único en Sandbox. `create-marketplace-paypal-order` obtiene precio y moneda del servidor, usa `PayPal-Request-Id` y crea la orden. `capture-marketplace-paypal-order` captura tras el retorno autenticado, pero no concede el beneficio. Solo `paypal-webhook`, después de verificar la firma, llama `process_marketplace_paypal_event` y activa siete días destacados.

Eventos configurables en el mismo webhook PayPal Sandbox:

- `CHECKOUT.ORDER.APPROVED`;
- `PAYMENT.CAPTURE.COMPLETED`;
- `PAYMENT.CAPTURE.DENIED`;
- `PAYMENT.CAPTURE.REFUNDED`;
- `PAYMENT.CAPTURE.REVERSED`.

Los eventos se guardan en `private.billing_events`, cuya clave primaria por proveedor/entorno/evento evita replays. Un monto o moneda diferente al setting server-side falla cerrado. Refund y reversal ocultan el anuncio y retiran `is_featured`.

## Rutas

- Público: `/marketplace`, `/marketplace/:slug`.
- Autenticado y `noindex`: `/marketplace/new`, `/marketplace/:id/edit`, `/account/marketplace`.
- Admin global: `/admin?section=marketplace`.

## Migración y rollback

Migraciones:

- `20260729010939_phase_7_marketplace_foundation.sql`;
- `20260729012207_marketplace_paypal_orders.sql`.

Rollback funcional reversible:

1. Poner `marketplace_enabled=false` y `payments_enabled=false` desde Admin.
2. Retirar las rutas públicas en una versión posterior si fuera necesario.
3. Mantener tablas y logs. No ejecutar `DROP` ni borrar pagos/reportes sin exportación, respaldo y aprobación.
4. Desprogramar `expire-marketplace-listings` solo si el marketplace completo queda deshabilitado; los anuncios existentes deben ocultarse de forma controlada.

## Estado operativo y pendientes

- Las dos migraciones se aplicaron en orden tras backup, comparación de historial y dry-run; local y remoto están alineados.
- La prueba RLS A/B con usuarios sintéticos pasó; falta validar moderación y settings con un Admin seguro.
- Configurar precio desde Admin únicamente cuando se vaya a probar Orders Sandbox.
- `create-marketplace-paypal-order`, `capture-marketplace-paypal-order` y `paypal-webhook` están desplegadas; pagos siguen apagados.
- Definir política legal final, retención y respuesta a reportes con asesoría profesional.
