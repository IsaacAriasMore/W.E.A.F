# Auditoría vigente del repositorio W.E.A.F

Fecha de corte: 22 de julio de 2026. Alcance: código local, rama `main` de `IsaacAriasMore/W.E.A.F`, configuración de Vercel, migraciones y funciones de Supabase, datos remotos de producción, pruebas y documentación.

## Estado comprobado

- La rama remota estaba en `ed0e1ff` (cierre de Fase 8) antes de integrar Fase 9.
- GitHub no tiene issues ni pull requests abiertos y no existe `.github/workflows`; el commit remoto revisado tampoco tiene ejecuciones de Actions.
- El repositorio tiene 180 archivos versionados: 69 en `src`, 43 en `supabase`, 26 en `docs`, 19 en `tests` y 11 en `public`.
- `npm audit` no encuentra vulnerabilidades, ni en producción ni incluyendo dependencias de desarrollo.
- No se detectaron secretos reales versionados y `.env.local` está ignorado.
- RLS sigue habilitado. Los RPC nuevos de Fase 9 tienen `search_path = ''`; el tracking solo es ejecutable por `service_role` y el control de placements vuelve a validar admin global.
- La migración `phase_9_internal_plus_ads` está aplicada y `track-server-event` versión 11 está activa con JWT obligatorio.
- Existen nueve placements internos. Ocho están activos y `home_hero_secondary` permanece desactivado para no saturar Home.
- El catálogo remoto tiene un servidor Plus promocionable y tres listings totales.

## Antes de anunciar una versión pública

### Prioridad 0 — contenido y operación comercial

- [ ] Reemplazar o retirar los listings de prueba visibles. En producción hay títulos y descripciones de test; no deben actuar como escaparate Plus real.
- [ ] Cargar datos revisados en Supabase. El estado remoto actual es: 4 especies, 0 INIs, 0 mapas, 0 bosses, 0 requisitos de boss y 0 documentos legales. Las páginas públicas dependen todavía de fallbacks locales pequeños.
- [ ] Completar al menos un mapa piloto con bosses, requisitos, especies e INIs verificadas, fuente y fecha de revisión.
- [ ] Validar Stripe de extremo a extremo en el entorno que se publicará: Normal, Plus, webhook, portal, renovación, pago fallido y cancelación. El feature flag remoto `stripe_payments` continúa desactivado y no debe activarse hasta terminar esa validación.
- [ ] Ejecutar la matriz manual con dos usuarios reales: aislamiento de tribus, roles owner/admin/member, admin global separado y propiedad de listings.
- [ ] Revisar profesionalmente términos, privacidad, cookies, reembolsos, política de servidores, reportes, contacto, independencia y disponibilidad de la marca W.E.A.F. Los textos actuales son preliminares.
- [ ] Confirmar el comportamiento real de recuperación de contraseña. El registro directo funciona sin confirmación, pero recuperación y una futura verificación dependen de SMTP, SPF, DKIM y DMARC.

### Prioridad 1 — seguridad y entrega continua

- [ ] Activar la protección de contraseñas filtradas en Supabase Auth cuando el plan lo permita. El asesor de seguridad remoto la reporta desactivada.
- [ ] Revisar y documentar la matriz de permisos de todos los RPC `SECURITY DEFINER`. Supabase avisa de funciones ejecutables por `authenticated`; muchas son intencionales y validan rol internamente, pero necesitan una lista de excepciones aprobada y pruebas negativas.
- [ ] Añadir GitHub Actions para ejecutar `check`, unitarias, build y E2E en cada pull request. Hoy no existe CI remota.
- [ ] Añadir primero CSP en modo Report-Only y después una política aplicada; evaluar también HSTS. `vercel.json` ya incluye `nosniff`, Referrer Policy y Permissions Policy, pero no estas dos defensas.
- [ ] Añadir índices a las claves foráneas `subscriptions.plan_id` y `subscriptions.checkout_payment_id` si las consultas reales confirman su uso. El asesor de rendimiento las marca sin índice.
- [ ] Probar recuperación, publicación y Stripe con el Service Worker activo después de limpiar versiones anteriores; ninguna ruta privada o de pago puede servirse desde caché.

### Prioridad 2 — calidad editorial y producto

- [ ] Completar i18n de superficies privadas y administrativas. Las páginas públicas principales tienen paridad ES/EN, pero dashboard, breeding, mutaciones, ajustes, billing y admin conservan textos en español.
- [ ] Registrar autor, procedencia y licencia de cada imagen o animación. Mantener la prohibición de assets oficiales de ARK.
- [ ] Decidir si se producirán los cuatro `.lottie` licenciados o si los fallbacks actuales serán definitivos.
- [ ] Medir LCP, CLS e INP en Vercel y en un móvil de gama media. Three.js está aislado y diferido, pero su chunk pesa aproximadamente 734 kB sin comprimir.
- [ ] Ampliar E2E autenticado contra un proyecto aislado. Los 19 casos actuales cubren rutas públicas y protección de invitados, no un ciclo real de tribu, admin o Stripe.
- [ ] Convertir los pendientes relevantes en issues de GitHub con responsable y criterio de aceptación; el repositorio no tiene backlog remoto visible.

## Fase 10 — publicidad externa

No está implementada ni debe activarse automáticamente. Antes de considerar AdSense u otro proveedor hacen falta revisión legal, CMP compatible, actualización de privacidad/cookies, CSP, inventario de placements permitido, política de menores/territorios, pruebas de rendimiento y una migración explícita que no debilite el proveedor `internal` actual.

## Orden recomendado

1. Limpiar listings de prueba y cargar el mapa piloto con datos reales.
2. Completar pruebas reales de RLS, Auth y Stripe; decidir la activación de `stripe_payments`.
3. Cerrar revisión legal y SMTP.
4. Añadir CI, protección de contraseñas filtradas y hardening de headers.
5. Completar i18n privado, licencias y métricas de rendimiento.
6. Solo entonces evaluar Fase 10.
