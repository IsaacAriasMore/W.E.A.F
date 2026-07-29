# Auditoría de seguridad W.E.A.F

Fecha: 2026-07-28. Alcance autorizado: repo local, Supabase enlazado en solo lectura y respuestas
públicas de `weaf.vercel.app`. Esta revisión reduce riesgo, pero no afirma seguridad absoluta.

## Threat model

### Activos

- Cuentas, sesiones y datos personales mínimos de perfiles.
- Tribus, miembros, breeding, invitaciones y webhooks Discord privados.
- Listings de servidores, catálogo, suscripciones, pagos e historial de eventos.
- Rol admin global, secretos de Edge Functions y reputación/indexación del sitio.

### Fronteras de confianza

1. Navegador público → Vercel SPA: entrada no confiable, sin secretos de servidor.
2. Navegador autenticado → Supabase Data API/RPC: JWT + RLS + ownership.
3. Edge Function → Postgres/PayPal/Discord: secretos y `service_role` exclusivos del servidor.
4. PayPal → webhook público: sin JWT, firma PayPal obligatoria antes de mutar estado.
5. Admin global → RPC/Edge: JWT, rol persistido en `profiles`, validación server-side y auditoría.

### Adversarios y abusos relevantes

- Visitante que intenta XSS, spam, scraping o manipular filtros/URLs.
- Usuario autenticado que cambia UUID para leer/escribir tribus, listings o pagos ajenos (IDOR).
- Propietario que altera precio, plan, `featured`, vigencia o estado desde DevTools.
- Reenvío/falsificación/desorden de webhooks y doble clic en checkout.
- Cuenta comprometida que busca privilegio admin o extracción de secretos.
- Dependencia, configuración o caché que expone una página privada o ejecuta código no esperado.

## Resultado por severidad

| Severidad | Hallazgo comprobado | Estado |
| --- | --- | --- |
| Alto | Cinco Edge Functions de usuario tenían `verify_jwt=false`; autorizaban dentro del handler, pero perdían la primera barrera de plataforma. | Corregido a doble validación (`verify_jwt=true` + actor/ownership/rol interno). |
| Alto | URLs de website/banner solo se validaban parcialmente; banner no tenía control de esquema en DB. | Corregido con constraints HTTPS, tamaño y caracteres peligrosos, sin reescribir filas históricas. |
| Medio | Producción no enviaba CSP ni protección anti-frame explícita. | Corregido en Vercel con CSP, `frame-ancestors`, `X-Frame-Options`, HSTS y Permissions-Policy ampliada. |
| Medio | Rutas privadas recibían el cache público genérico de la SPA y eran indexables por cabecera. | Corregido con `private, no-store` y `X-Robots-Tag` para Auth, app, admin, billing y resultados de pago. |
| Medio | Navegación SPA no rechazaba de forma explícita destinos cross-origin si un caller interno futuro pasaba una URL completa. | Corregido: `navigate` y `replace` fallan cerrados fuera del origen. |
| Medio | UUID de tres funciones PayPal aceptaba cualquier combinación de guiones/hex de longitud 36. | Corregido con patrón UUID canónico y soporte de claim `sub`. |
| Medio | Webhook devolvía 200 a eventos desconocidos antes de verificar firma. No mutaba datos, pero permitía tráfico no autenticado indistinguible. | Corregido: toda carga con ID/tipo verifica firma antes de aceptar o ignorar. |
| Bajo | Tracking reutilizaba `SUPABASE_SERVICE_ROLE_KEY` como salt si faltaba `CLICK_HASH_SECRET`. | Corregido: tracking falla de forma no crítica si falta el secreto dedicado. |
| Bajo | Cancelación, catálogo y reconciliación no tenían límites consistentes de cuerpo; límite `NaN` era posible. | Corregido con límites y normalización 1–50. |
| Informativo | `npm audit` no reporta vulnerabilidades conocidas. | 0 vulnerabilidades al 2026-07-28. |

## Supabase, RLS y autorización

- Las 33 migraciones locales coinciden con las 33 remotas hasta
  `20260729012207_marketplace_paypal_orders.sql`; no se reparó ni borró historial.
- Tablas públicas nuevas de billing tienen RLS; catálogo interno revoca acceso directo y expone una
  RPC sanitizada. Suscripciones/pagos solo permiten lectura del propietario y admins vía funciones.
- RPCs privilegiadas fijan `search_path=''`; los grants finales separan `authenticated` y
  `service_role`. Los handlers de servicio no confían en `user_metadata`.
- Admin se comprueba contra `profiles.global_role`/`private.is_global_admin()`, no contra campos del
  navegador. Roles de tribu siguen separados de admin global.
- El lint remoto conserva el aviso legacy de una variable no leída en Stripe y un aviso de volatilidad
  en `private.validate_marketplace_payload`; no se modificó una migración ya aplicada.
- No se detectaron buckets de Storage usados por la app ni suscripciones Realtime en el frontend.

## Edge Functions

| Tipo | Funciones | Control requerido |
| --- | --- | --- |
| Usuario | Discord, checkouts/portal legacy, catálogo PayPal, crear/cancelar PayPal | JWT de plataforma + `auth:"user"` + ownership/admin. |
| Webhook | PayPal y Stripe legacy | `verify_jwt=false` deliberado; firma del proveedor y evento idempotente. |
| Worker | expiración y reconciliación | `verify_jwt=false` deliberado; `auth:"secret"`, lote limitado y RPC service-only. |
| Público | tracking | Payload cerrado, rate limit DB, hash IP con secreto dedicado y fallo no bloqueante. |

Ningún secreto se devuelve al cliente. Los logs revisados usan códigos/IDs operativos y no imprimen
tokens, cookies, claves ni encabezados Authorization.

## Frontend y API

- El render usa plantillas HTML, pero datos externos se pasan por `escapeHtml`; enlaces de servidor
  añaden `noopener noreferrer`. Los nuevos constraints reducen esquemas de URL peligrosos.
- Los redirects post-Auth usan `safeInternalDestination`; el router ahora aplica el mismo principio.
- Sesiones persisten mediante Supabase y se cierran tras cuatro horas de inactividad. No se guardan
  datos privados de tribu en `localStorage`; solo preferencias/ID de selección y timestamps.
- Precio, estado pagado, featured y vigencia no proceden del navegador en el flujo de billing.
- Source maps de producción no están habilitados por Vite.

## Headers y caché

La lectura de producción confirmó HSTS de Vercel y también confirmó la ausencia previa de CSP.
Después del Preview deben verificarse: CSP sin violaciones funcionales, `DENY` de framing,
`nosniff`, referrer/permissions y `no-store` en rutas privadas. El Service Worker ya excluye Auth,
app, admin, billing, publish, success, cancel, Stripe y Functions.

## Dependencias

- Versiones directas y lockfile están fijados.
- `npm audit --audit-level=low`: 0 vulnerabilidades.
- No se agregaron dependencias para esta fase.

## Riesgos residuales y pasos manuales

- Activar CAPTCHA/rate limits adicionales para Auth si aparece abuso; requiere configuración de
  proveedor y secreto fuera del repo.
- Verificar en Dashboard la protección de contraseñas filtradas y el estado de MFA para admins.
- La app permite registro sin confirmación por decisión de producto; aumenta riesgo de emails falsos.
- CSP usa `style-src 'unsafe-inline'` por estilos/motion actuales. Retirarlo requiere nonces o una
  refactorización CSS separada.
- Validar constraints históricos antes de convertirlos de `NOT VALID` a validados; no limpiar datos
  sin revisión.
- Rate limiting perimetral/WAF para endpoints públicos debe configurarse en el proveedor si el
  volumen lo exige.
- Las pruebas activas de IDOR/RLS se ejecutaron con dos usuarios sintéticos: B no pudo leer ni editar
  tribus, servidores, pagos o anuncios privados de A, ni alterar featured/expiración. Falta el rol Admin.

## Verificación de regresión

- `tests/security-audit.test.js` cubre headers, JWT, límites de confianza, URLs, navegación y salt.
- Ejecutar `supabase db push --dry-run`, `supabase db lint --linked`, unitarios y build antes de
aplicar/desplegar.

## Cierre de hallazgos del Preview

- La defensa de checkout destacado exige simultáneamente el flag global `paypal_payments`, el switch
  local, precio server-side y entorno/base Sandbox en Edge y PostgreSQL. Con cualquier switch
  apagado, `prepare_marketplace_paypal_order` falla antes del `INSERT`.
- La nueva RPC `admin_update_marketplace_report_status(uuid,text)` usa `SECURITY DEFINER`,
  `search_path=''`, estados cerrados, validación de admin global y auditoría. `PUBLIC` y `anon` no
  tienen ejecución; `authenticated` puede entrar solo para que la autorización interna compruebe el
  rol persistido.
- La prueba remota con `ROLLBACK` confirmó que un reportante normal no puede escribir la tabla ni
  usar la RPC, mientras el admin sí puede y genera un solo evento de auditoría.
- Requests reales al Preview confirmaron CSP, HSTS, `DENY`, `nosniff`, Permissions Policy y
  `private, no-store`; las rutas exactas `/app` y `/account` incluyen `max-age=0`.
- El lint remoto conserva solo dos warnings preexistentes: volatilidad de
  `private.validate_marketplace_payload` y `new_subscription_id` sin uso en Stripe legacy.
- En Preview comprobar login, Discord, checkout/cancelación Sandbox y consola CSP.
