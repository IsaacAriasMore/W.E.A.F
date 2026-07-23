# Fase 11 - Checklist manual accionable

## Perfil, navegación y tribus múltiples

- [ ] A 360 px, abrir/cerrar el menú y probar Inicio, Perfil, Admin condicional, Mi tribu y Salir.
- [ ] Confirmar que un usuario normal no ve Admin y que `/admin` lo redirige.
- [ ] Editar nombre visible, Discord, avatar y juego; confirmar que email, rol y suspensión no cambian.
- [ ] Crear una segunda tribu, cambiar entre ambas y confirmar que la primera conserva miembros y breeding.
- [ ] Renombrar como owner; repetir como admin/member y confirmar rechazo.
- [ ] Archivar escribiendo el nombre exacto y marcando la confirmación; comprobar que desaparece del selector.

## Breeding, cuidadores y wipe

- [ ] Crear línea con stats base y cuidador activo; probar también Sin asignar.
- [ ] Confirmar que member puede ver y registrar mutación, pero no crear línea ni cambiar cuidador.
- [ ] Probar 55→57 = 1 y 55→75 = 10.
- [ ] Probar delta cero/negativo, delta 1 y delta impar sin confirmación.
- [ ] Verificar actor, cuidador, totales por stat, total y último registro.
- [ ] Reiniciar breeding como owner/admin; confirmar snapshot, stats actuales=base, acumulados vacíos y cooldowns cancelados.
- [ ] Confirmar que una tribu distinta no puede leer líneas, mutaciones ni snapshots.

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
- [ ] Completar `docs/stripe-live-readiness.md`; no cambiar secrets ni flags Live durante esta fase.

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
- [x] Ejecutar `npm run check`, `npm run test:unit`, `npm run build` y `npm run test:e2e` (77 archivos, 82 unitarias y 19 E2E; 22-07-2026).
- [ ] Hacer push, esperar CI verde y repetir smoke de producción.
