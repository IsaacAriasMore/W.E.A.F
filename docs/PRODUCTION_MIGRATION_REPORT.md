# Reporte de despliegue controlado de Supabase

Fecha de ejecución: 2026-07-28 (America/Costa_Rica) / 2026-07-29 UTC. Operador: Codex con
autorización del propietario. Proyecto: `vwxqewpvtucygbaethkv`. Rama:
`codex/audit-security-seo-marketplace`. Commit base auditado:
`2b13cf3b94ea8cf431bab6eb781e93d86523e677`.

## Límites preservados

- PR #3 permanece Draft y no se hizo merge.
- PayPal opera exclusivamente en Sandbox.
- `paypal_payments=false` y Marketplace `payments_enabled=false`.
- No se ejecutaron cargos, no se activó PayPal Live y Stripe histórico no se eliminó.
- No se imprimieron, versionaron ni copiaron secretos.

## Prerrequisitos y backups

Docker Desktop 4.84.0 quedó operativo con Client 29.6.2 y Server Engine 29.6.2. Se descartó el
respaldo anterior de 0 bytes y se generó desde cero un conjunto nuevo fuera del repositorio:

`E:\W.E.A.F-Backups\20260728-220144`

| Archivo | Tamaño |
| --- | ---: |
| `weaf-schema.sql` | 335507 bytes |
| `weaf-data.sql` | 106496 bytes |
| `migration-list-before.txt` | 2760 bytes |
| `configuration-snapshot-before.txt` | 446 bytes |
| `count-snapshot-before.json` | 797 bytes |
| `count-snapshot-post-migration.json` | 931 bytes |
| `qa-snapshot-after.json` | 431 bytes |
| `SHA256SUMS.txt` | 644 bytes |

Todos son legibles y mayores que cero; `SHA256SUMS.txt` permite comprobar integridad. El dump de
datos terminó con código 0, pero pg_dump advirtió ciclos de claves foráneas entre listings,
suscripciones, ofertas y versiones. Una restauración data-only debe usar el esquema ya restaurado y
considerar desactivar triggers temporalmente dentro de un procedimiento aprobado; no improvisar un
restore parcial en producción.

## Migraciones

El historial estaba alineado hasta `20260723230000_paypal_security_audit_fixes.sql`. El dry-run
mostró exactamente cuatro migraciones, sin repair ni borrado de historial:

1. `20260729003759_phase_1_security_hardening.sql`
2. `20260729004321_paypal_kill_switch.sql`
3. `20260729010939_phase_7_marketplace_foundation.sql`
4. `20260729012207_marketplace_paypal_orders.sql`

`npx supabase db push --linked --yes` terminó correctamente en aproximadamente 47 segundos. Una
advertencia posterior del catálogo pg-delta no pudo leer un certificado CA temporal, pero ocurrió
después de aplicar y registrar las migraciones. La comparación final confirmó las 33 entradas local
y remoto alineadas hasta la cuarta migración.

Validación posterior:

- seis tablas marketplace con RLS y seis categorías iniciales;
- marketplace habilitado, pagos deshabilitados, precio `null`, moneda USD y entorno Sandbox;
- `paypal_payments=false`, una suscripción Sandbox histórica y cero suscripciones no Sandbox;
- cron de expiración `*/15 * * * *` presente;
- tres constraints HTTPS permanecen `NOT VALID` deliberadamente para no reescribir datos históricos;
- grants, trigger de kill switch y `SECURITY DEFINER search_path=''` comprobados.

`supabase db lint` terminó sin errores. Conserva dos warnings: la variable Stripe legacy
`new_subscription_id` no leída y la volatilidad declarada de `private.validate_marketplace_payload`.
Este último debe corregirse en una migración nueva; no se editará el historial aplicado.

## Integridad de datos

Antes del push: 9 perfiles, 4 tribus, 4 server listings, 1 suscripción, 1 pago, 3 eventos privados y
9 usuarios Auth activos. Después de las migraciones, los conteos y fingerprints de billing, listings,
pagos, eventos y Stripe histórico quedaron idénticos.

La QA A/B creó dos usuarios sintéticos, una tribu y un anuncio marketplace gratuito; por ello el
snapshot final contiene 11 perfiles, 5 tribus, 4 server listings y un anuncio marketplace oculto.
Billing y Stripe histórico permanecen sin cambios y marketplace tiene 0 pagos.

## Edge Functions

Se auditaron y desplegaron secuencialmente ocho funciones:

| Función | Versión | JWT |
| --- | ---: | --- |
| `track-server-event` | 22 | desactivado deliberadamente; RPC/rate limit interno |
| `manage-paypal-catalog` | 5 | requerido |
| `create-paypal-subscription` | 5 | requerido |
| `cancel-paypal-subscription` | 5 | requerido |
| `reconcile-paypal-subscriptions` | 3 | secreto interno |
| `paypal-webhook` | 3 | firma PayPal obligatoria |
| `create-marketplace-paypal-order` | 1 | requerido |
| `capture-marketplace-paypal-order` | 1 | requerido |

El helper compartido rechaza cualquier modo distinto de `sandbox` y cualquier API base distinta de
`https://api-m.sandbox.paypal.com`. Un smoke test no mutante devolvió 400 para tracking inválido y
para un webhook sin firma. No hubo respuestas 5xx ni exposición de secretos.

## Pruebas y observabilidad

- `npm run check`: pasa, 88 archivos frontend.
- `npm run test:unit`: 130/130.
- `npm run test:e2e`: 20/20 en 10.6 s con Vite controlado explícitamente.
- `npm run build`: pasa.
- `npm audit --audit-level=low`: 0 vulnerabilidades.
- API últimas 24 h: 92 respuestas 200, 4 de 204, 2 de 400, 2 de 403 y 0 de 5xx.
- Edge últimas 24 h: 26 entradas, sin 5xx, errores de arranque ni patrones de secretos.

Los errores Postgres observados correspondieron a denegaciones esperadas de la prueba RLS y a una
consulta read-only de verificación corregida en el acto. No hubo recursión, timeout ni fallo de cron.

## QA funcional

Con usuarios A/B sintéticos se comprobó que A puede crear/editar/ocultar su anuncio gratuito y que B
no puede modificarlo, destacar o alterar su expiración. B tampoco pudo leer pagos de A, ver/editar la
tribu de A ni modificar un servidor ajeno. El anuncio quedó oculto y sin featured al terminar.

Pendiente: el Preview requiere Vercel Authentication, por lo que no se completó QA visual de consola,
CSP, responsive, cuenta y Admin. Tampoco se probó el rol Admin por no disponer de una sesión segura.
No se debe compartir una contraseña por chat; la validación debe hacerse con una sesión iniciada o un
mecanismo temporal y revocable.

## Rollback

1. Mantener ambos switches de pagos en `false`; no detener webhooks/reconciliación de obligaciones existentes.
2. Revertir frontend y Edge Functions al deployment/commit anterior si aparece una regresión.
3. Preservar las tablas, billing, eventos, reportes y auditoría; no ejecutar `DROP`, `TRUNCATE` ni borrar historial.
4. Si el esquema necesita cambio, crear una migración compensatoria revisada y respaldada.
5. Para recuperación mayor, verificar hashes y ensayar los dumps en un proyecto aislado antes de restaurar.
6. Stripe legacy permanece disponible como evidencia/rollback y no participa en la UI nueva.

## Decisión de liberación

El despliegue técnico de base y funciones está completado, pero no se autoriza activar pagos ni pasar
el PR a Ready. Antes se requiere QA visual/Admin y la matriz PayPal Sandbox. PayPal Live continúa fuera
de alcance.

## Hotfix posterior de Preview (2026-07-29 UTC)

El historial se comparó de nuevo antes del push: las 33 migraciones previas estaban alineadas y el
dry-run mostró exclusivamente:

- `20260729055627_marketplace_paypal_global_kill_switch.sql`;
- `20260729060503_admin_marketplace_report_status.sql`.

Ambas se aplicaron en ese orden y el listado final quedó con 35 timestamps locales/remotos
alineados. No se reparó, borró ni reescribió historial. Se desplegó únicamente la Edge Function
modificada `create-marketplace-paypal-order`.

Validación final:

- `paypal_payments=false`, Marketplace `payments_enabled=false`, `environment=sandbox`;
- `marketplace_enabled=true` mantiene disponible el tablón gratuito;
- 0 filas en `marketplace_payments`; no hubo orden, cargo, cancelación, refund ni reversal;
- prueba SQL transaccional con `ROLLBACK`: usuario normal/reportante bloqueado, escritura directa
  bloqueada, estado inválido y reporte inexistente bloqueados, admin permitido y audit log creado;
- `check`, 140 unitarias, 20 E2E, build y `npm audit` (0 vulnerabilidades) pasaron;
- CI y Vercel pasaron para el Preview
  `https://weaf-git-codex-audit-security-s-af7809-isaacariasmores-projects.vercel.app`.

Requests reales autenticados por Vercel CLI confirmaron CSP y `private, no-store` en todas las rutas
privadas pedidas; `/app` y `/account`, exactas y con hijas, incluyen también `max-age=0`. El layout
Admin se verificó con fixture sintético a 390×844, 768×1024 y 1280×720, sin overflow del documento
ni controles recortados. El fixture, servidor local, enlace Vercel y token temporal se retiraron.

Rollback del hotfix: mantener ambos interruptores de pago en `false`, redesplegar la Edge Function
desde `5d6a8d4` si fuera necesario y usar una migración compensatoria para restaurar la definición
anterior de `prepare_marketplace_paypal_order` o retirar la RPC nueva. No editar los dos archivos ya
aplicados ni borrar reportes, auditoría o pagos.

## Cierre de seguridad Auth/JWT (2026-07-29)

No se aplicaron migraciones ni se modificaron datos, usuarios, flags o pagos. Se redesplegaron
exclusivamente las dos funciones Stripe legacy solicitadas con la configuración actual del repo:

| Función | Antes | Después | Resultado |
| --- | ---: | ---: | --- |
| `create-server-listing-checkout` | v12, JWT desalineado | v13 | `ACTIVE`, `verify_jwt=true`, sin JWT → 401 |
| `create-billing-portal-session` | v11, JWT desalineado | v12 | `ACTIVE`, `verify_jwt=true`, sin JWT → 401 |

Las otras doce funciones conservaron sus versiones. No se usó `--no-verify-jwt`, no se creó checkout,
no se abrió portal y no se llamó a Stripe o PayPal. El smoke con JWT de usuario queda limitado a un
`GET` esperado 405 cuando haya sesión QA compartida.

El frontend añadió Turnstile sin dependencia nueva y con rollout por flag. `.env.example` contiene
solo `VITE_AUTH_CAPTCHA_ENABLED=false` y `VITE_TURNSTILE_SITE_KEY=`; no existe variable de secret. La
CSP permite únicamente el origen oficial en script/frame. Preview de la rama recibió ambas variables
públicas con la site key oficial de prueba; Production y Supabase CAPTCHA no se tocaron.

La inspección pública remota confirmó registro habilitado, autoconfirmación de email, mínimo de 8
caracteres y ausencia actual de enforcement CAPTCHA. Los límites privados y MFA deben revisarse en el
Dashboard sin extraer credenciales. El procedimiento de activación y rollback está en
`docs/DEPLOYMENT_CHECKLIST.md`.

**Decisión temporal:** no declarar protección anti-bot completa. Frontend preparado y validado;
enforcement autoritativo pendiente de activación inmediata después del despliegue de `main`.
