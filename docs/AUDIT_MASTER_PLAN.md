# Plan maestro de auditoría W.E.A.F

Actualizado: 2026-07-28. Rama: `codex/audit-security-seo-marketplace`.

## Alcance y límites

Auditoría y mejora incremental de seguridad, PayPal Sandbox, servidores, mantenibilidad,
rendimiento, SEO, marketplace de recursos y UX. Producción se inspecciona inicialmente en modo
solo lectura. Quedan prohibidos PayPal Live, cobros reales, secretos en el repositorio, bypass de
RLS, borrados de historial y merge automático.

## Inventario inicial

- Frontend: Vite 7, JavaScript ESM, 10 páginas públicas, 5 privadas, 4 de Auth y un dashboard admin.
- Datos: 33 migraciones locales y remotas alineadas hasta
  `20260729012207_marketplace_paypal_orders.sql`.
- Backend: funciones PayPal y marketplace desplegadas en Sandbox; Stripe legacy preservado.
- Pagos: catálogo versionado, suscripciones PayPal Sandbox y Stripe preservado para rollback.
- QA: 130 pruebas unitarias y 20 E2E Playwright después de la ampliación.
- Entrega: Vercel SPA, PWA/service worker y CI de GitHub.

## Línea base antes de cambios

| Control | Resultado | Evidencia / riesgo |
| --- | --- | --- |
| `npm install` | Pasa | Lockfile sin cambio. |
| `npm run check` | Pasa | 79 archivos frontend. |
| `npm run test:unit` | Pasa | 105/105. |
| `npm run build` | Pasa | Three.js quedó diferido y dividido; ningún chunk supera 500 kB. |
| `npm run test:e2e` | 1 fallo, ejecución agotó 120 s | `/servers/owners` recibió cero planes desde catálogo remoto; 18 casos llegaron a ejecutarse. |
| Migraciones | Alineadas | 29 timestamps coinciden local/remoto; no requiere repair. |
| `supabase db lint` | 1 warning legacy | Variable `new_subscription_id` nunca leída en función Stripe histórica. |
| `npm audit --audit-level=low` | Pasa | 0 vulnerabilidades conocidas. |

El fallo E2E se tratará como fragilidad de aislamiento: una prueba pública no debe depender de que
el catálogo remoto esté disponible. No se declarará verde hasta repetirla.

## Riesgos priorizados

1. **Alto:** verificar que `paypal_payments` sea un kill switch server-side real.
2. **Alto:** auditar ownership/RLS/RPC y las funciones con `verify_jwt=false`.
3. **Alto:** marketplace nuevo debe impedir manipular precio, pago, featured y expiración.
4. **Medio:** `/servers/success` usa una fecha de listing que puede ser nula en PayPal renovable.
5. **Medio:** cabeceras carecen todavía de CSP, anti-frame y política explícita para privados.
6. **Medio:** `robots.txt` y `sitemap.xml` no existen como archivos estáticos y caen al rewrite SPA.
7. **Medio:** dashboard admin monolítico (~74 KB fuente) y renders completos en acciones.
8. **Corregido:** Three.js producía un chunk minificado de 734 KB; la importación modular y diferida elimina el warning y reduce el total gzip aproximadamente 26.5 %.
9. **Bajo:** textos hardcodeados ES y lógica Stripe legacy mezclada en servicios actuales.
10. **Informativo:** falta validación manual completa de Plus, refund, reversal y fallos Sandbox.

## Fases y checklist verificable

### 0. Guardrails y línea base — terminado

- [x] Crear rama aislada.
- [x] Comparar migraciones local/remoto y ejecutar lint remoto de solo lectura.
- [x] Registrar check, unitarios, build y E2E.
- [x] Crear `AGENTS.md` y este plan.
- [x] Repetir `npm audit` con red y capturar resultado.

### 1. Seguridad integral — terminado; validación Admin pendiente

- [x] Threat model, matriz RLS/grants/RPC y auditoría de las Edge Functions.
- [x] Auth, roles, ownership/IDOR, sesiones, storage/realtime y exposición de PII.
- [x] XSS/URLs/redirects/SSRF, límites de payload, rate limit y logs.
- [x] CSP, frame protection, HSTS, cache privado y regresiones.
- [x] Entregable: `docs/SECURITY_AUDIT.md`.
- [x] Ejecutar matriz multiusuario A/B contra Supabase con cuentas sintéticas.
- [ ] Completar matriz con una sesión Admin segura.

### 2. PayPal Sandbox — terminado en código; matriz Sandbox pendiente

- [x] Catálogo, checkout, webhook, diez eventos, idempotencia y orden temporal.
- [x] Kill switch real sin detener webhooks/reconciliación existentes.
- [x] Corregir fecha de `/servers/success`, ES/EN y estados de interfaz.
- [x] Inventario Stripe y rollback sin borrar historia.
- [x] Entregable: `docs/PAYPAL_AUDIT.md`.
- [ ] Ejecutar Plus/cancel/refund/reversal/failure/reconcile en PayPal Sandbox desplegado.

### 3–5. Servidores, refactor y rendimiento — terminado en código; medición de campo pendiente

- [x] Auditar las seis rutas de servidores, billing, admin, responsive y accesibilidad.
- [x] Normalizar servicios, centralizar estados/textos y reducir el handler admin crítico.
- [x] Aislar pruebas del catálogo remoto y prevenir doble envío.
- [x] Reducir y separar Three.js; documentar la línea base y presupuesto.
- [ ] Medir Core Web Vitals en Preview y dispositivo móvil real.
- [x] Añadir marketplace gratuito, RLS/RPCs, moderación, reportes y expiración automática de siete días.
- [x] Aplicar y probar las migraciones del marketplace en Supabase tras backup y dry-run.
- [x] Implementar PayPal Orders Sandbox, captura server-side y webhook idempotente para anuncios destacados.
- [ ] Desplegar y probar una orden destacada completa en PayPal Sandbox después de aplicar migraciones y definir precio.

### 6. SEO técnico — terminado

- [x] `robots.txt`, `sitemap.xml`, canonical, metadata, OG/Twitter, hreflang y JSON-LD.
- [x] Noindex de Auth, cuenta, admin, checkout y espacios privados.
- [x] Evaluar prerender sin inventar contenido ni schema.
- [x] Entregables: `docs/SEO_AUDIT.md` y `docs/SEO_PAGE_MATRIX.md`.

### 7–8. Marketplace y UX — desplegado con pagos desactivados

- [x] Marketplace gratuito, RLS, moderación, reportes, anti-spam y expiración exacta de 7 días.
- [x] Precio featured administrable y desactivado por defecto.
- [x] PayPal Orders v2 Sandbox server-side, captura/webhook/idempotencia/refund/reversal.
- [x] Admin, cuenta, rutas públicas indexables y estados visuales ES/EN.
- [x] QA visual público desktop/tablet/móvil, teclado, foco, contraste y estados vacíos/error/loading.
- [x] Entregables: `docs/MARKETPLACE.md` y `docs/UX_AUDIT.md`.
- [x] Validar ownership, expiración y aislamiento A/B con identidades sintéticas.
- [ ] Validar visualmente Preview y Admin con una sesión segura.
- [ ] Validar pagos únicamente en PayPal Sandbox cuando se autorice encender los switches.

### 9. Cierre y entrega — cierre técnico completado; QA manual pendiente

- [x] Unit/E2E estáticos, seguridad, pagos y build finales.
- [x] `docs/DEPLOYMENT_CHECKLIST.md` y `docs/REMAINING_RISKS.md`.
- [x] Commits por fase, Vercel Preview y PR Draft sin merge.
- [x] Enumerar secrets solo por nombre, eventos webhook, pasos manuales y rollback.
- [x] Registrar migraciones, funciones, backups, pruebas y logs en el reporte de producción.

## Archivos inicialmente afectados

`AGENTS.md`, `docs/`, `vercel.json`, `public/`, metadata/router, servicios y páginas de servidores,
i18n, utilidades de billing, pruebas, nuevas migraciones y Edge Functions del marketplace. Cada
cambio de esquema se hará en migración nueva; no se reescribirá historial aplicado.

## Criterio de estado

- **Terminado:** pruebas relevantes pasan y existe evidencia reproducible.
- **Parcial:** código terminado, pero depende de una validación manual Sandbox/Preview documentada.
- **Bloqueado:** requiere secreto, acción irreversible, DNS, PayPal Live, pago real o merge.
