# Fase 11 - QA de producción, seguridad, Stripe y CI/CD

Fecha de inicio: 22 de julio de 2026.

## Objetivo

Pasar de una aplicación funcional a una operación inicial con controles repetibles. Esta fase prioriza QA, seguridad, datos de prueba, Stripe test, CI, observabilidad y preparación manual; no agrega features grandes.

## Validado en este corte

- `main` y `origin/main` contenían `4aed71f` y `e0bcc13` antes de iniciar los cambios.
- Smoke público correcto en `/`, `/maps-bosses`, `/inis`, `/servers` y `/servers/owners`, sin errores de consola observados.
- `/servers/publish`, `/app` y `/admin` redirigen a login cuando no hay sesión.
- Producción carga los 14 mapas, 20 bosses, requisitos de The Island y 3 INIs de Fase 10.
- Cero listings remotos y cero tablas públicas sin RLS en el corte.
- Registro directo reciente, webhook, portal y tracking responden en los logs revisados.
- CI valida check, unit tests y build sin secrets ni despliegue.

## Resultado automatizado

- `npm run check`: correcto, 74 archivos frontend revisados.
- `npm run test:unit`: 74/74.
- `npm run build`: correcto, 125 módulos transformados.
- `npm run test:e2e`: 19/19 en Chrome desktop.

E2E permanece manual porque Playwright levanta un servidor y necesita navegador instalado. No forma parte del job obligatorio de CI de esta fase.

## Checklist de lanzamiento

- [ ] Completar QA manual Normal, Plus, cancelación y fallo de pago en Stripe test.
- [ ] Revisar/limpiar pagos y customers de QA después de la prueba.
- [ ] Ejecutar aislamiento con dos usuarios y prueba de Admin con usuario normal.
- [ ] Revisar Auth Redirect URLs, SMTP y recuperación.
- [ ] Revisar logs Supabase, Vercel y Stripe durante una ventana completa de prueba.
- [ ] Ejecutar Lighthouse/Web Vitals en rutas críticas y móvil 360 px.
- [ ] Confirmar backups, soporte, legal, reembolsos e investigación de marca.
- [ ] Repetir smoke después del push y del deploy de esta fase.

## Riesgos abiertos

- Leaked password protection sigue desactivada.
- Los Advisors requieren revisión periódica, en especial RPC `SECURITY DEFINER` nuevas.
- SMTP no está listo para confirmación obligatoria confiable.
- Stripe end-to-end necesita ejecución manual en Dashboard test.
- Los logs de Vercel no pudieron consultarse con la integración disponible.
- Catálogo editorial fuera de The Island, INIs verificadas y especies siguen incompletos.
- Legal, reembolsos, privacidad y marca requieren revisión profesional antes de cobros live.

## Decisiones de alcance

- No activar Stripe live hasta cerrar QA y operación manual.
- No activar confirmación obligatoria hasta disponer de dominio y SMTP autenticado.
- No integrar AdSense ni publicidad externa.
- Mantener exclusivamente promociones internas Plus con consentimiento de medición.
- No rediseñar, migrar a React ni reescribir la arquitectura.

Consulta también `phase-11-manual-checklist.md`, `phase-11-stripe-qa.md`, `security-review-phase-11.md` y los checklists de Auth, datos, performance y observabilidad.
