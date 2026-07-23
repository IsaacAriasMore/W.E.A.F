# Fase 11 - Checklist manual accionable

## Datos y Admin

- [ ] Abrir Admin y confirmar que no hay listing `TEST`, Normal o Plus publicado por error.
- [ ] Si aparece uno, pausarlo/ocultarlo/archivarlo y desactivar destacado; no borrarlo sin revisar relaciones.
- [ ] Cotejar los 5 pagos y 2 Customers de QA con Stripe test.
- [ ] Crear/editar/archivar un mapa, boss, requisito e INI en draft con admin global.
- [ ] Repetir las RPC de Admin con usuario normal y confirmar rechazo.

## Stripe test

- [ ] Completar publicación Normal de USD 3 y verificar directorio sin promoción.
- [ ] Completar Plus de USD 7 y verificar destacado/placements internos.
- [ ] Cancelar desde Billing Portal y confirmar retiro inmediato.
- [ ] Simular `invoice.payment_failed` y confirmar pausa.
- [ ] Revisar entregas y reintentos del webhook en Stripe Dashboard.
- [ ] Mantener Live mode desactivado.

## Seguridad, Auth y SMTP

- [ ] Probar aislamiento con Usuario A y Usuario B para tribus y listings.
- [ ] Revisar Supabase Security/Performance Advisors.
- [ ] Revisar Redirect URLs y allowlist de admin.
- [ ] Probar registro directo, login, onboarding, logout y cuatro horas de inactividad.
- [ ] Probar reset de contraseña y registrar el resultado de entrega.
- [ ] No activar Confirm email hasta tener dominio, SPF, DKIM, DMARC y SMTP probado.

## Logs y performance

- [ ] Revisar Edge/Auth/Postgres en Supabase después de cada flujo.
- [ ] Confirmar que no reaparece `service_role_required` en tracking.
- [ ] Revisar Runtime/Functions logs del proyecto correcto en Vercel.
- [ ] Ejecutar Lighthouse y revisar Speed Insights si está disponible.
- [ ] Probar 360 px, reduced motion y consumo CPU/GPU del hero.
- [ ] Probar actualización del Service Worker sin cachear Auth o Stripe.

## Legal, contenido y salida

- [ ] Obtener revisión profesional de términos, privacidad, cookies, reembolsos y política de servidores.
- [ ] Investigar disponibilidad de marca W.E.A.F y confirmar disclaimer de independencia.
- [ ] Revisar licencia de banners y assets antes de publicar.
- [ ] No publicar requisitos de bosses, mapas o INIs sin fuente y fecha.
- [ ] Ejecutar `npm run check`, `npm run test:unit`, `npm run build` y `npm run test:e2e`.
- [ ] Hacer push, esperar CI verde y repetir smoke de producción.
