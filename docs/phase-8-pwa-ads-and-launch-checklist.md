# Fase 8: privacidad, anuncios y PWA

## Entregado

- Consentimiento granular para almacenamiento necesario, analítica y publicidad.
- Banner inicial, panel de preferencias y acceso permanente desde el pie de página.
- Promociones internas conectadas a `ads_settings` y a publicaciones Plus activas.
- Espacios discretos en Inicio, INIs, Mapas y Bosses, Criaturas, Servidores y dashboard de tribu.
- Exclusión explícita de breeding, mutaciones, configuración, publicación y checkout.
- Medición de impresiones y clics solo después de consentimiento.
- Manifest instalable, iconos normal y maskable, icono de iOS y colores de aplicación.
- Prompt de instalación para navegadores Chromium e instrucciones manuales para iPhone y iPad.
- Service worker de producción y pantalla sin conexión. No cachea Supabase ni otros orígenes.
- Safe areas para dispositivos con notch y navegación móvil existente conservada.

Los anuncios externos no cargan scripts todavía. La estructura permite incorporarlos más adelante cuando exista proveedor, configuración de privacidad revisada y consentimiento válido.

## Imprescindible antes de publicar

- [ ] Elegir el dominio definitivo y desplegar el frontend con HTTPS.
- [ ] Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el hosting.
- [ ] Configurar `PUBLIC_SITE_URL` en los secretos de Supabase con el dominio definitivo.
- [ ] Ajustar Site URL y Redirect URLs en Supabase Auth para producción y recuperación de contraseña.
- [ ] Configurar SMTP, remitente y plantillas de correo de Supabase Auth.
- [ ] Activar protección contra contraseñas filtradas en Supabase Auth.
- [ ] Añadir claves Stripe de producción y `STRIPE_WEBHOOK_SECRET` en Supabase.
- [ ] Crear en Stripe el webhook que apunta a `/functions/v1/stripe-webhook` y seleccionar los eventos documentados en Fase 7.
- [ ] Activar las feature flags comerciales solo después de probar checkout, renovación, cancelación y expiración.
- [ ] Revisar términos, privacidad, cookies, reembolsos y jurisdicción con asesoría legal.
- [ ] Confirmar la disponibilidad de la marca W.E.A.F en WIPO, USPTO y el registro local aplicable.
- [ ] Sustituir o validar datos de demostración de INIs, criaturas, mapas y bosses.
- [ ] Revisar correo de soporte, Discord del creador y tiempos de respuesta publicados.

## Para que aparezcan promociones internas

- [ ] Completar Stripe o crear una publicación manual autorizada.
- [ ] Publicar al menos un servidor activo con plan Plus o estado destacado.
- [ ] Activar desde Administración los placements deseados de `ads_settings`.
- [ ] Verificar título, descripción, región, idioma y enlace de Discord de cada servidor.

Mientras no exista un servidor Plus activo, el espacio queda oculto y no deja huecos vacíos.

## Opcional para una segunda salida

- [ ] Elegir proveedor de anuncios externos y obtener publisher ID y slot IDs.
- [ ] Actualizar el inventario de proveedores y finalidades en la política de cookies.
- [ ] Validar requisitos de consentimiento por país antes de activar publicidad externa.
- [ ] Añadir capturas de pantalla al manifest para enriquecer la ficha de instalación.
- [ ] Conectar monitoreo de errores, alertas operativas y métricas de disponibilidad.
- [ ] Definir copias de seguridad, recuperación ante incidentes y calendario de revisión de RLS.
- [ ] Ejecutar QA final en Chrome, Edge, Safari iOS y Android real.
