# Checklist manual de cierre — Fase 8

Ejecutar este checklist en el preview de Vercel y repetir los puntos críticos en producción. No requiere cambiar RLS, roles, Stripe ni Supabase.

## Preparación

- [ ] Confirmar que el despliegue corresponde al commit de cierre de Fase 8.
- [ ] DevTools no muestra errores al cargar Home.
- [ ] Limpiar el Service Worker anterior: Application → Service Workers → Unregister; Application → Storage → Clear site data; recargar.
- [ ] Confirmar que el worker nuevo usa `weaf-shell-v5`.
- [ ] Probar una vez con movimiento normal y otra con `prefers-reduced-motion: reduce`.

## Público, escritorio y móvil

- [ ] `/` carga primero el contenido y la imagen hero; Three.js aparece después sin salto de layout.
- [ ] `/inis`, `/maps-bosses`, `/creatures` y `/servers` muestran filtros, vacíos, cards y botones legibles en ES y EN.
- [ ] `/servers/owners#owner-plans` baja suavemente a Normal/Plus y ambos CTA navegan al plan correcto.
- [ ] `/servers/publish` sin query muestra el selector; `?plan=normal` y `?plan=plus` muestran el formulario correcto después de autenticarse.
- [ ] `/login`, `/register`, `/reset-password` y `/onboarding` son utilizables a 360–390 px y con teclado.
- [ ] Términos, privacidad, cookies, reembolsos, servidores, reportes y contacto indican su carácter preliminar.
- [ ] No hay overflow horizontal a 360 px, 768 px ni escritorio.

## Usuario y tribu

- [ ] Un usuario sin tribu ve onboarding/estado vacío y puede crear o unirse a una tribu.
- [ ] Dashboard, miembros, breeding, mutaciones y ajustes muestran loaders/vacíos sin bloquear acciones.
- [ ] Owner/admin/member de tribu conservan permisos separados del admin global.
- [ ] Logout funciona y la inactividad de cuatro horas cierra la sesión.
- [ ] Cambiar varias veces entre Home, Auth y `/app` no deja canvas ni animaciones duplicadas.

## Publicación y Stripe en modo test

- [ ] Crear un listing Normal y otro Plus con un usuario autenticado.
- [ ] Checkout usa el precio correspondiente y solo permite listings del usuario.
- [ ] Cancel vuelve al formulario guardado y muestra estado visual de cancelación.
- [ ] Success muestra confirmación; el webhook activa el listing y conserva `stripe_customer_id`/suscripción.
- [ ] Billing Portal abre y retorna a `/account/billing`.
- [ ] Las rutas `/servers/publish`, `/servers/success`, `/servers/cancel`, `/account/billing`, `/auth` y `/functions` nunca se sirven desde caché.
- [ ] Si no hay SMTP, recuperación de contraseña presenta un error claro sin romper Auth.

## Admin y seguridad

- [ ] `/admin` no carga GSAP, Three.js ni dotLottie.
- [ ] Contenido público y servidores conservan validación, slug automático y selectores estructurados.
- [ ] Un usuario común no puede abrir Admin ni elevarse a admin global.
- [ ] Con dos usuarios, ninguno puede leer o modificar tribus/listings ajenos.

## Cierre técnico

- [ ] `npm run check`.
- [ ] `npm run test:unit`.
- [ ] `npm run build`.
- [ ] `npm run test:e2e`; si Playwright termina los casos pero queda colgado al cerrar en Windows, guardar el log y verificar que no exista un fallo funcional previo al teardown.
- [ ] Revisar LCP, CLS e INP en Vercel después del despliegue.
