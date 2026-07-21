# Arquitectura

## Frontend

Vite compila una SPA en JavaScript vanilla. `src/router.js` resuelve rutas, carga páginas con imports dinámicos, actualiza metadatos y restaura el foco al navegar. Los componentes devuelven HTML semántico y enlazan eventos después de renderizar.

Los datos de Fase 1 son fixtures inmutables. Cada módulo de datos imita la respuesta futura de Supabase para reducir el trabajo de integración.

## Backend futuro

Supabase será el backend administrado:

- Auth para sesión e identidad.
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

## Rendimiento

- Imports dinámicos por página.
- Un único asset hero optimizado durante build y con dimensiones reservadas.
- Sin framework UI ni runtime de componentes.
- Filtros y checklists locales sin round trip.
- Assets futuros servidos por CDN y con lazy loading.
