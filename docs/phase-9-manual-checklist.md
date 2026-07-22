# Checklist manual — Fase 9

## Preparación

- [ ] El despliegue contiene la migración `phase_9_internal_plus_ads` y la última versión de `track-server-event`.
- [ ] Existe al menos un servidor Plus test activo, pagado, no cancelado y vigente.
- [ ] DevTools no muestra errores de Supabase, CSP ni Service Worker.

## Superficies públicas

- [ ] `/` muestra el rail Plus; si no hay elegibles muestra el CTA editorial.
- [ ] `/inis` mantiene filtros/copiado y el slot lateral no bloquea contenido.
- [ ] `/maps-bosses` conserva mapa, dificultad y checklist local.
- [ ] `/creatures` mantiene búsqueda/filtros; el slot pasa debajo en móvil.
- [ ] `/servers` coloca Plus arriba, diferencia su badge y conserva todos los filtros.
- [ ] Un resultado vacío permite limpiar filtros o publicar y no muestra un slot roto.
- [ ] `/servers/owners` explica la promoción interna Plus.
- [ ] `/servers/publish` muestra preview antes del formulario, nunca dentro del pago.

## Usuario

- [ ] `/app` muestra como máximo una recomendación discreta.
- [ ] Cerrar la recomendación la oculta durante siete días.
- [ ] `/app/breeds`, `/app/mutations` y `/app/tribe-settings` no contienen anuncios invasivos.
- [ ] Login, registro, onboarding y logout conservan su comportamiento.

## Admin

- [ ] `/admin?section=governance` muestra nueve placements, provider interno y conteo Plus.
- [ ] Un admin global puede activar/desactivar un placement.
- [ ] Un usuario normal no puede ejecutar `admin_set_ads_placement`.
- [ ] Desactivar un placement lo oculta después de recargar sin afectar los demás.

## Consentimiento y tracking

- [ ] Sin consentimiento: anuncios visibles, sin invocar `track-server-event`.
- [ ] Con consentimiento: impresión al 55% y clics Discord/sitio registrados.
- [ ] Cambiar consentimiento durante la sesión no duplica observers ni eventos.
- [ ] No aparecen cookies, iframes ni scripts publicitarios externos.

## Stripe y seguridad

- [ ] Plus pagado aparece en Home, directorio y placements activos.
- [ ] Normal pagado permanece en el directorio, pero no se promociona.
- [ ] `pending_payment`, `failed`, `paused`, `expired`, `hidden`, `rejected` y `canceled` nunca se promocionan.
- [ ] Cancelar la suscripción oculta inmediatamente la ficha y elimina `is_featured`.
- [ ] RLS sigue activo en `server_listings` y `ads_settings`.

## Responsive y accesibilidad

- [ ] Probar 360 px, 768 px y escritorio.
- [ ] Todos los controles tienen foco visible y objetivos táctiles utilizables.
- [ ] `prefers-reduced-motion` detiene badge y skeleton animados.
- [ ] La etiqueta “Promoción interna” es visible en ES y EN.
