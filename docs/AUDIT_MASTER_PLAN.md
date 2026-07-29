# Plan maestro de auditoría W.E.A.F

Actualizado: 2026-07-28. Rama: `codex/audit-security-seo-marketplace`.

## Alcance y límites

Auditoría y mejora incremental de seguridad, PayPal Sandbox, servidores, mantenibilidad,
rendimiento, SEO, marketplace de recursos y UX. Producción se inspecciona inicialmente en modo
solo lectura. Quedan prohibidos PayPal Live, cobros reales, secretos en el repositorio, bypass de
RLS, borrados de historial y merge automático.

## Inventario inicial

- Frontend: Vite 7, JavaScript ESM, 10 páginas públicas, 5 privadas, 4 de Auth y un dashboard admin.
- Datos: 29 migraciones locales y remotas alineadas hasta
  `20260723230000_paypal_security_audit_fixes.sql`.
- Backend: 12 Edge Functions; cinco PayPal, cuatro Stripe legacy, Discord, tracking y expiración.
- Pagos: catálogo versionado, suscripciones PayPal Sandbox y Stripe preservado para rollback.
- QA: 105 pruebas unitarias y 19 E2E Playwright.
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

### 0. Guardrails y línea base — en curso

- [x] Crear rama aislada.
- [x] Comparar migraciones local/remoto y ejecutar lint remoto de solo lectura.
- [x] Registrar check, unitarios, build y E2E.
- [x] Crear `AGENTS.md` y este plan.
- [x] Repetir `npm audit` con red y capturar resultado.

### 1. Seguridad integral — pendiente

- [ ] Threat model, matriz RLS/grants/RPC y auditoría de las 12 Edge Functions.
- [ ] Auth, roles, ownership/IDOR, sesiones, storage/realtime y exposición de PII.
- [ ] XSS/URLs/redirects/SSRF, límites de payload, rate limit y logs.
- [ ] CSP, frame protection, HSTS, cache privado y regresiones.
- [ ] Entregable: `docs/SECURITY_AUDIT.md`.

### 2. PayPal Sandbox — pendiente

- [ ] Catálogo, checkout, webhook, diez eventos, idempotencia y orden temporal.
- [ ] Kill switch real sin detener webhooks/reconciliación existentes.
- [ ] Corregir fecha de `/servers/success`, ES/EN y estados de interfaz.
- [ ] Inventario Stripe y rollback sin borrar historia.
- [ ] Entregable: `docs/PAYPAL_AUDIT.md`.

### 3–5. Servidores, refactor y rendimiento — pendiente

- [ ] Auditar las seis rutas de servidores, billing, admin, responsive y accesibilidad.
- [ ] Separar `adminDashboard.js`, normalizar servicios y centralizar estados/textos.
- [ ] Aislar pruebas del catálogo remoto y prevenir doble envío.
- [x] Reducir y separar Three.js; documentar la línea base y presupuesto.
- [ ] Medir Core Web Vitals en Preview y dispositivo móvil real.
- [x] Añadir marketplace gratuito, RLS/RPCs, moderación, reportes y expiración automática de siete días.
- [ ] Aplicar y probar la migración del marketplace en Supabase después de corregir el BOM local.
- [x] Implementar PayPal Orders Sandbox, captura server-side y webhook idempotente para anuncios destacados.
- [ ] Desplegar y probar una orden destacada completa en PayPal Sandbox después de aplicar migraciones y definir precio.

### 6. SEO técnico — pendiente

- [ ] `robots.txt`, `sitemap.xml`, canonical, metadata, OG/Twitter, hreflang y JSON-LD.
- [ ] Noindex de Auth, cuenta, admin, checkout y espacios privados.
- [ ] Evaluar prerender sin inventar contenido ni schema.
- [ ] Entregables: `docs/SEO_AUDIT.md` y `docs/SEO_PAGE_MATRIX.md`.

### 7–8. Marketplace y UX — pendiente

- [ ] Marketplace gratuito, RLS, moderación, reportes, anti-spam y expiración exacta de 7 días.
- [ ] Precio featured administrable y desactivado por defecto.
- [ ] PayPal Orders v2 Sandbox server-side, captura/webhook/idempotencia/refund/reversal.
- [ ] Admin, cuenta, rutas públicas indexables y estados visuales ES/EN.
- [ ] QA visual desktop/tablet/móvil, teclado, foco, contraste y estados vacíos/error/loading.
- [ ] Entregable: `docs/MARKETPLACE.md`.

### 9. Cierre y entrega — pendiente

- [ ] Unit/E2E/RLS/seguridad/pagos y build finales.
- [ ] `docs/DEPLOYMENT_CHECKLIST.md` y `docs/REMAINING_RISKS.md`.
- [ ] Commits por fase, Vercel Preview y PR sin merge.
- [ ] Enumerar secrets solo por nombre, eventos webhook, pasos manuales y rollback.

## Archivos inicialmente afectados

`AGENTS.md`, `docs/`, `vercel.json`, `public/`, metadata/router, servicios y páginas de servidores,
i18n, utilidades de billing, pruebas, nuevas migraciones y Edge Functions del marketplace. Cada
cambio de esquema se hará en migración nueva; no se reescribirá historial aplicado.

## Criterio de estado

- **Terminado:** pruebas relevantes pasan y existe evidencia reproducible.
- **Parcial:** código terminado, pero depende de una validación manual Sandbox/Preview documentada.
- **Bloqueado:** requiere secreto, acción irreversible, DNS, PayPal Live, pago real o merge.
