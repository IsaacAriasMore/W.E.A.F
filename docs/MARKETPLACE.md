# Marketplace de recursos W.E.A.F

## Alcance público

El marketplace es un tablón comunitario exclusivo de ARK: Survival Ascended (ASA) para comprar, vender o intercambiar recursos mediante contacto directo por Discord. W.E.A.F no procesa el intercambio entre jugadores, no actúa como escrow y no garantiza una operación.

Las filas históricas ASE/Both se conservan sin modificación para auditoría y rollback, pero no aparecen en el catálogo público. Nuevas creaciones y ediciones pasan por RPCs server-side que exigen `game='ascended'`.

## Publicación gratuita

- Cuenta y aceptación explícita de reglas.
- Siete días desde `published_at`.
- Máximo de cinco anuncios activos/borradores/pagos pendientes y cinco creaciones por 24 horas.
- El propietario puede editar un anuncio elegible u ocultarlo.
- Estado, vigencia, precio y destacado nunca proceden del navegador.
- RLS y grants mínimos permanecen activos; toda escritura usa RPC con ownership.

## Destacado

Destacado es una exposición adicional, no una garantía de venta. Su precio fijo es USD 3 por siete días y solo está preparado para PayPal Sandbox. `published_at` se conserva; el webhook firmado o la reconciliación por API (`confirm_marketplace_paypal_capture_from_api`) establecen `featured_started_at` y `featured_expires_at`, y extienden `expires_at` solo si hace falta. La reconciliación por API se usa cuando una captura ya está `COMPLETED` en PayPal y su webhook no llegó (ver [marketplace-paypal-capture-reconciliation.md](./marketplace-paypal-capture-reconciliation.md)); el webhook tardío duplicado no vuelve a activar el beneficio.

Refund, reversal, denegación, fallo o vencimiento retiran `is_featured` sin eliminar el anuncio, el pago ni los eventos. La captura de retorno del navegador nunca concede el beneficio.

Los kill switches siguen siendo autoritativos y continúan apagados:

- `feature_flags.paypal_payments=false`;
- `marketplace_settings.payments_enabled=false`;
- entorno `sandbox`.

La allowlist QA vive exclusivamente en el esquema `private`, usa UUID de usuario y no contiene correos hardcodeados en frontend. Es un gate adicional y jamás elude los dos kill switches.

## Catálogo v2 y privacidad

`get_marketplace_catalog_v2` separa hasta cuatro Destacados del resultado orgánico, aplica filtros ASA autoritativos y usa keyset pagination con cursor firmado. El orden es determinista por buckets de 15 minutos y una hora, limita repetición de vendedores y reserva aproximadamente 10 % de exploración orgánica.

La afinidad persistente es opt-in. El usuario puede activarla, desactivarla y reiniciar eventos/intereses desde `/account/marketplace`. Las señales tienen vida media de 30 días y retención máxima preparada de 90 días. No se habilita cron remoto en esta fase.

No se almacenan IP, fingerprint, contraseñas, JWT, cookies, cabeceras Authorization ni CAPTCHA. Los visitantes sin sesión reciben ranking contextual sin identidad anónima persistente.

Detalle técnico y rollback: [marketplace-ranking.md](./marketplace-ranking.md).

## Contenido, moderación y estados

Se prohíben HTML, credenciales, tokens, cuentas robadas, cheats, exploits, datos sensibles, fraude y enlaces maliciosos. Discord admite `https://discord.gg/...` o `https://discord.com/invite/...`; la imagen opcional debe ser HTTPS.

Estados legacy conservados: `draft`, `pending_payment`, `active`, `expired`, `hidden`, `rejected`, `removed`, `payment_failed`, `refunded` y `reversed`. La nueva revocación del destacado no fuerza el estado del anuncio a refund/reversed: separa pago, beneficio y publicación.

## Operación pendiente

Las tres migraciones de esta fase y la Edge Function modificada son locales. No se aplicaron migraciones, funciones, cron, flags, Auth ni configuración PayPal remota. Antes de producción se requiere backup válido, historial alineado, revisión SQL, lint, dry-run, Preview, autorización separada y pruebas Sandbox controladas.
