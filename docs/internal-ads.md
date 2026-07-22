# Anuncios internos de W.E.A.F

## Alcance

La Fase 9 usa publicaciones Plus activas como promoción interna dentro de W.E.A.F. No integra AdSense, redes publicitarias, scripts de terceros, cookies externas ni creatividades ajenas. El anuncio siempre se identifica como **Promoción interna** y muestra únicamente datos ya públicos del servidor.

Un anuncio interno es una distribución adicional de una ficha Plus pagada o concedida manualmente. Publicidad externa sería contenido comprado por terceros y requeriría un proveedor, nuevas reglas legales, consentimiento específico, moderación y controles de seguridad que no forman parte de esta fase.

## Placements

| Placement | Superficie | Estado inicial |
| --- | --- | --- |
| `home_featured_servers` | Rail de servidores Plus en Home | Activo |
| `home_hero_secondary` | Promoción secundaria discreta en Home | Desactivado para evitar saturación |
| `inis_sidebar` | Lateral de INIs; baja bajo el contenido en móvil | Activo |
| `maps_bosses_sidebar` | Bloque entre herramienta y ayuda de bosses | Activo |
| `creatures_sidebar` | Junto a filtros; debajo en móvil | Activo |
| `servers_featured` | Destacado superior del directorio | Activo |
| `tribe_dashboard_soft` | Recomendación cerrable en dashboard | Activo |
| `empty_state_server_recommendation` | Recomendación en resultados vacíos | Activo |
| `server_publish_example` | Vista previa no transaccional del beneficio Plus | Activo |

Todos usan `provider = internal`. Cada fila conserva `enabled`, `configuration` y `updated_at`. Solo un administrador global puede modificarlas mediante `admin_set_ads_placement`.

## Elegibilidad

`src/utils/serverPromotion.js` aplica una comprobación fail-closed. Una ficha se puede promocionar solo cuando:

- `status = active`;
- el pago está `paid`, o es manual con `not_required`/`paid`;
- es Plus o está marcada como `is_featured` por administración;
- no tiene `cancel_at_period_end`;
- no está pendiente, pausada, oculta, rechazada, vencida ni cancelada;
- `starts_at`, `expires_at` y `current_period_end`, cuando existen, contienen una ventana vigente.

La política RLS continúa limitando la lectura pública a publicaciones activas y pagadas. El helper frontend añade una segunda barrera para los placements, pero no sustituye RLS ni los triggers de Stripe.

## Medición y consentimiento

Los anuncios son visibles aunque el usuario no acepte medición. Sin consentimiento no se invoca tracking.

Con consentimiento de analítica o publicidad interna:

- `impression` se registra una vez cuando al menos 55% de la card es visible;
- `discord_click` se registra al abrir Discord;
- `website_click` se registra al abrir el sitio del servidor;
- el Edge Function anonimiza la IP con un hash y deduplica impresiones/clics por ventana temporal;
- no se envían datos del dueño, de la tribu ni información privada.

Los observadores y listeners se desconectan cuando el slot sale del DOM. Si el consentimiento cambia durante la sesión, las cards visibles se observan desde ese momento, sin medición retroactiva.

## Recomendación del dashboard

`tribe_dashboard_soft` muestra como máximo una ficha y puede cerrarse. La preferencia se guarda durante siete días en `localStorage` con la clave `weaf:dismissed-ad:tribe_dashboard_soft`. Este almacenamiento es funcional para recordar la decisión del usuario; no identifica ni perfila a la persona.

## Administración

En Admin → Gobernanza → Anuncios se muestran:

- nombre humano y clave técnica del placement;
- provider interno;
- estado activo/desactivado;
- cantidad de servidores promocionables;
- preview de la primera ficha elegible;
- toggle para activar o desactivar.

El RPC valida rol global, lista permitida, provider interno y tamaño de configuración. Cada cambio genera auditoría administrativa.

## Prueba

1. Crear y pagar un servidor Plus en Stripe test.
2. Confirmar webhook, `status=active`, `payment_status=paid`, `is_featured=true`.
3. Activar el placement desde Admin.
4. Abrir la superficie en escritorio y móvil.
5. Sin consentimiento, verificar que la card aparece y los contadores no cambian.
6. Aceptar medición, exponer más de 55% de la card y probar Discord/sitio web.
7. Cancelar la suscripción y confirmar que el servidor desaparece del directorio y de todos los placements.

## Publicidad externa futura

AdSense u otro proveedor permanece fuera de alcance. Antes de considerarlo hacen falta revisión legal profesional, CMP/consentimiento por finalidad, inventario de cookies, política de proveedores, Content Security Policy, moderación de creatividades, bloqueo en rutas críticas, análisis de rendimiento y una migración explícita que amplíe providers. La Fase 9 no deja ninguna ruta oculta para activar publicidad externa por configuración.
