# Arquitectura

## Frontend

Vite compila una SPA en JavaScript vanilla. `src/router.js` resuelve rutas, carga páginas con imports dinámicos, actualiza metadatos y restaura el foco al navegar. Los componentes devuelven HTML semántico y enlazan eventos después de renderizar.

Los datos públicos de Fase 1 siguen siendo fixtures inmutables. La identidad de Fase 2 usa `@supabase/supabase-js`, un store de sesión en memoria y servicios separados para Auth y perfiles.

Las rutas `/login` y `/register` son exclusivas para visitantes. `/onboarding` requiere una sesión y redirige a `/login?next=/onboarding` cuando no existe. El router conserva imports dinámicos por pantalla.

## Backend

Supabase será el backend administrado:

- Auth para sesión e identidad, activo desde Fase 2.
- PostgreSQL para datos públicos y privados.
- Storage para avatares, especies, banners y previews.
- Edge Functions para Discord, Stripe y endpoints con secretos.
- Cron para expiraciones y alertas.

## Límites de confianza

1. El navegador nunca recibe `service_role`, Stripe secret ni webhook de Discord.
2. `tribe_id` proveniente del cliente nunca concede acceso por sí mismo.
3. PostgreSQL verifica membresía en cada operación privada.
4. Edge Functions vuelven a autenticar al usuario y validan pertenencia o rol.
5. Las acciones sensibles producen audit logs.
6. El cliente solo puede actualizar columnas editables del perfil; `global_role`, `is_suspended` y `email` no tienen privilegio de actualización.

## Sesión

Supabase conserva y renueva el token en el navegador. W.E.A.F añade un temporizador de actividad de 4 horas, sincronizado entre pestañas mediante una marca temporal sin datos sensibles. Al vencer, ejecuta un cierre local, redirige al ingreso y explica el motivo en un diálogo accesible. `supabase/config.toml` aplica además el mismo límite en Auth local.

## Rendimiento

- Imports dinámicos por página.
- Un único asset hero optimizado durante build y con dimensiones reservadas.
- Sin framework UI ni runtime de componentes.
- Filtros y checklists locales sin round trip.
- Assets futuros servidos por CDN y con lazy loading.
