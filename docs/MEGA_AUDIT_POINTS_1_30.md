# Auditoría integral W.E.A.F. — puntos 1 a 30

Fecha: 2026-08-01

Base auditada: `46a00e235776de016169d742bb7b8b8afe8ae13a`

Rama: `codex/audit-weaf-points-1-30-hardening`

## Veredicto ejecutivo

**APPROVED WITH CHANGES para Draft PR. NO-GO para despliegue o pagos.**

El código local corrige cuatro defectos comprobados: credenciales locales de
prueba incrustadas, paginación inestable entre transacciones, transiciones no
monotónicas del webhook Marketplace y reset incompleto de datos de
recomendación. No se aplicó ninguna migración, función, secreto, flag o cambio
de Auth remoto; tampoco se llamó a PayPal.

## Matriz de 30 puntos

| # | Área | Estado | Evidencia principal |
|---:|---|---|---|
| 1 | Higiene Git y trazabilidad | PASS | detector sobre `git ls-files`; JWT locales retirados; backup vacío eliminado |
| 2 | Arquitectura y trust boundaries | PASS | navegador → RPC/Edge; `service_role` solo servidor; PayPal REST solo Edge |
| 3 | ASA y legacy | PASS | constraint `NOT VALID`, filtros ASA y datos legacy preservados |
| 4 | Ciclo de vida del anuncio | PASS | publicación, featured y expiración usan fechas separadas |
| 5 | Precio/moneda/duración | PASS | 300 minor, USD, Sandbox y 7 días resueltos server-side |
| 6 | Máquina de estados de pago | PASS local | migración `marketplace_webhook_state_integrity`; 26 casos SQL |
| 7 | Creación y recuperación de orden | PASS | cierre limitado a `created`, service-role-only e idempotencia |
| 8 | URL de aprobación | PASS | HTTPS y hosts Sandbox exactos; Live/credenciales/subdominios rechazados |
| 9 | Captura/reconciliación API | PASS local | GET de captura existente, sin segundo POST, confirmación estricta |
| 10 | Webhook/auditoría segunda transacción | PASS local | firma previa, RPC de fallo independiente y HTTP 500 conservado |
| 11 | Idempotencia/concurrencia/doble clic | PASS | claves únicas, locks de fila, request IDs y locks de UI |
| 12 | Refund/reversal/denial tardíos | PASS local | denial no revoca beneficio ajeno; terminales monotónicos |
| 13 | Expiración featured | PASS | cron/RPC idempotente y timestamps preservados |
| 14 | Kill switches/allowlist | PASS | lectura remota: ambos pagos `false`, entorno `sandbox` |
| 15 | Configuración/secretos/CORS/logs | PASS | valores no versionados; logs Marketplace sin event IDs; Live rechazado |
| 16 | RPC/SECURITY DEFINER | PASS | inventario local: `search_path=''`, grants mínimos revisados |
| 17 | RLS/ownership/BOLA | PASS | matrices SQL 35/35 y REST completas |
| 18 | Auditoría/minimización | PASS | payload financiero privado, frontend y logs sanitizados |
| 19 | Equidad featured | PASS | máximo uno por vendedor en bloque inicial, déficit y rotación |
| 20 | Ranking orgánico/exploración | PASS | filtros/contexto primero, fairness, frescura y exploración determinista |
| 21 | Consentimiento | PASS | opt-in, sin persistencia anónima y control ES/EN |
| 22 | Eventos/resistencia al abuso | PARTIAL | allowlist, 120/h, dedupe y metadata cerrada; falta límite diario/per-acción |
| 23 | Privacidad/retención/reset | PASS local | reset ahora elimina eventos, intereses e impresiones del actor |
| 24 | Cursor/rotación | PASS local | snapshot firmado v2; REST separada sin duplicados; 25/25 SQL |
| 25 | UI/UX/a11y/i18n | PARTIAL | 26/26 E2E y 390/768; no se hizo auditoría manual completa con lector |
| 26 | Password/Auth/Turnstile | PARTIAL | unitarias y E2E pasan; configuración Auth remota no fue modificada ni re-auditada |
| 27 | Rendimiento/índices | PARTIAL | budgets e índices pasan; falta prueba de carga con cardinalidad productiva |
| 28 | Tests/CI/dependencias/web | PASS | 247 unitarias, 26 E2E, build, budget y audit sin vulnerabilidades |
| 29 | Migraciones/deploy/rollback | PARTIAL | 41 remotas, 46 locales, 5 pendientes; dry-run exacto y sin divergencia |
| 30 | Preparación final | NO-GO remoto | cambios aún solo locales/Draft; pruebas Sandbox reales deliberadamente pendientes |

## Hallazgos y correcciones

| ID | Severidad | Hallazgo | Corrección/estado |
|---|---|---|---|
| AUD-01 | LOW | Cuatro JWT `supabase-demo` locales y un backup SQL vacío estaban rastreados | Resuelto en `cb378a6`; carga dinámica local y prueba de higiene |
| AUD-02 | MEDIUM | `now()` cambiaba el score entre páginas y repetía el último anuncio | Resuelto localmente con cursor v2 y snapshot estable |
| AUD-03 | HIGH | IDs PayPal mezclados podían reconciliarse por `OR`; DENIED tardío podía quitar un beneficio capturado | Resuelto localmente con validación cruzada y estados monotónicos |
| AUD-04 | MEDIUM | Reset conservaba impresiones personales | Resuelto localmente; elimina las tres fuentes personalizadas |
| AUD-05 | LOW | `db reset` buscaba un `seed.sql` inexistente | Resuelto: seeds automáticos deshabilitados; fixtures siguen explícitos |
| RISK-01 | MEDIUM | Eventos de recomendación tienen límite horario, pero no diario/per-acción ni serialización por actor | Pendiente como hardening separado; impacto limitado al perfil propio y almacenamiento |
| RISK-02 | LOW | Lint informa una variable Stripe legacy sin usar | Pendiente fuera del flujo nuevo PayPal |
| RISK-03 | INFORMATIONAL | Refund/reversal/failure y una orden completa no fueron probados contra PayPal Sandbox real | Pendiente tras migrar/desplegar y abrir una ventana QA autorizada |

## Validación reproducible

- `npm run check`: 96 archivos.
- `npm run test:unit`: 247/247.
- `npm run test:e2e:ci`: 26/26 Chromium, un worker.
- `npm run build`: aprobado; 368 módulos, 8 rutas prerenderizadas.
- `npm run check:budget`: JS inicial 33.3/40 KB gzip; CSS 12.6/15 KB.
- `npm audit --audit-level=low`: 0 vulnerabilidades.
- `npx supabase db reset`: aprobado desde cero con 46 migraciones locales.
- SQL: RLS 35/35, cursor 25/25, captura/webhook 26/26.
- PowerShell REST: ambas matrices aprobadas y paginación sin duplicados.
- `db lint --local/--linked`: solo warning Stripe legacy preexistente.
- `migration list --linked`: 41 aplicadas, 5 pendientes, sin historial divergente.
- `db push --dry-run --linked`: propone exactamente las cinco pendientes.

## Estado remoto de solo lectura

- Proyecto vinculado: `vwxqewpvtucygbaethkv`.
- Marketplace público habilitado; `payments_enabled=false`.
- `paypal_payments=false`; Marketplace `environment=sandbox`.
- `create-marketplace-paypal-order` ACTIVE v4, `verify_jwt=true`.
- `capture-marketplace-paypal-order` ACTIVE v2, `verify_jwt=true`.
- `paypal-webhook` ACTIVE v4, `verify_jwt=false` por diseño; verifica firma PayPal internamente.
- Secretos requeridos presentes por nombre; valores no fueron leídos ni mostrados.
- Cero escrituras remotas durante la auditoría.

## Migraciones pendientes y despliegue documentado

Orden del dry-run:

1. `20260731233000_marketplace_capture_api_reconciliation.sql`
2. `20260731235900_marketplace_capture_reconciliation_failure_audit.sql`
3. `20260801173359_marketplace_catalog_cursor_snapshot.sql`
4. `20260801174140_marketplace_webhook_state_integrity.sql`
5. `20260801174910_marketplace_recommendation_reset_privacy.sql`

Después de backup y aprobación separada: aplicar las cinco en orden, verificar
ACL/RPC, desplegar individualmente `paypal-webhook`, revisar logs sanitizados y
solo entonces evaluar una nueva orden Sandbox QA. Los pagos deben seguir
apagados durante migración y despliegue.

## Rollback

Mientras no exista despliegue remoto, el rollback es un `git revert` de los
commits de esta rama; no se necesita ni se debe usar `migration repair`.

Si las migraciones llegan a aplicarse, el rollback debe ser compensatorio:

- publicar una migración nueva que restaure la definición anterior de cada RPC;
- desplegar la versión anterior de `paypal-webhook` por SHA conocido;
- mantener ambos kill switches apagados durante todo el rollback;
- no borrar `billing_events`, pagos, auditorías ni datos legacy;
- no afirmar que `migration repair` deshace SQL (solo cambia historial);
- el borrado ya solicitado por un usuario mediante el reset de privacidad no es
  recuperable y no debe reconstruirse desde otros datos.

## GO/NO-GO

| Etapa | Decisión |
|---|---|
| Código local | GO |
| Draft PR | GO |
| Marcar Ready | NO-GO hasta revisión humana/CI del PR |
| Aplicar migraciones | NO-GO hasta backup y aprobación explícita |
| Desplegar Edge Functions | NO-GO hasta migraciones y aprobación explícita |
| Nueva orden Sandbox | NO-GO hasta deploy validado y ventana QA |
| Pagos QA | NO-GO; flags permanecen apagados |
| Pagos generales | NO-GO |
| Producción PayPal | NO-GO; Live continúa prohibido |
